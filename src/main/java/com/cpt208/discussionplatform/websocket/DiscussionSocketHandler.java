package com.cpt208.discussionplatform.websocket;

import com.cpt208.discussionplatform.entity.Session;
import com.cpt208.discussionplatform.entity.User;
import com.cpt208.discussionplatform.enums.RoleType;
import com.cpt208.discussionplatform.repository.GroupMemberRepository;
import com.cpt208.discussionplatform.repository.SessionParticipantRepository;
import com.cpt208.discussionplatform.service.JwtService;
import com.cpt208.discussionplatform.service.SessionService;
import com.cpt208.discussionplatform.service.TokenBlacklistService;
import com.cpt208.discussionplatform.service.UserService;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.net.URI;
import java.net.URLDecoder;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

@Component
public class DiscussionSocketHandler extends TextWebSocketHandler {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final Map<Long, Set<WebSocketSession>> sessionsBySessionId = new ConcurrentHashMap<Long, Set<WebSocketSession>>();
    private final Map<String, Long> socketSessionMapping = new ConcurrentHashMap<String, Long>();
    private final JwtService jwtService;
    private final TokenBlacklistService tokenBlacklistService;
    private final UserService userService;
    private final SessionService sessionService;
    private final SessionParticipantRepository sessionParticipantRepository;
    private final GroupMemberRepository groupMemberRepository;

    public DiscussionSocketHandler(JwtService jwtService,
                                   TokenBlacklistService tokenBlacklistService,
                                   UserService userService,
                                   SessionService sessionService,
                                   SessionParticipantRepository sessionParticipantRepository,
                                   GroupMemberRepository groupMemberRepository) {
        this.jwtService = jwtService;
        this.tokenBlacklistService = tokenBlacklistService;
        this.userService = userService;
        this.sessionService = sessionService;
        this.sessionParticipantRepository = sessionParticipantRepository;
        this.groupMemberRepository = groupMemberRepository;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession socketSession) throws Exception {
        Long sessionId = resolveAuthorizedSessionId(socketSession);
        sessionsBySessionId
            .computeIfAbsent(sessionId, key -> ConcurrentHashMap.newKeySet())
            .add(socketSession);
        socketSessionMapping.put(socketSession.getId(), sessionId);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession socketSession, CloseStatus status) {
        Long sessionId = socketSessionMapping.remove(socketSession.getId());
        if (sessionId == null) {
            return;
        }
        Set<WebSocketSession> scopedSessions = sessionsBySessionId.get(sessionId);
        if (scopedSessions == null) {
            return;
        }
        scopedSessions.remove(socketSession);
        if (scopedSessions.isEmpty()) {
            sessionsBySessionId.remove(sessionId);
        }
    }

    public void broadcast(DiscussionMessage message) {
        if (message.getSessionId() == null) {
            return;
        }
        try {
            String payload = objectMapper.writeValueAsString(message);
            for (WebSocketSession socketSession : sessionsBySessionId.getOrDefault(message.getSessionId(), ConcurrentHashMap.newKeySet())) {
                if (socketSession.isOpen()) {
                    socketSession.sendMessage(new TextMessage(payload));
                }
            }
        } catch (IOException ignored) {
        }
    }

    private Long resolveAuthorizedSessionId(WebSocketSession socketSession) {
        Map<String, String> query = parseQuery(socketSession.getUri());
        String token = query.get("token");
        String rawSessionId = query.get("sessionId");
        if (token == null || token.isEmpty() || rawSessionId == null || rawSessionId.isEmpty()) {
            throw new IllegalArgumentException("WebSocket authentication is invalid");
        }
        String tokenId = jwtService.getTokenId(token);
        if (tokenBlacklistService.isBlacklisted(tokenId)) {
            throw new IllegalArgumentException("WebSocket authentication is invalid");
        }
        Long sessionId = Long.valueOf(rawSessionId);
        Long userId = jwtService.getUserId(token);
        User user = userService.getUser(userId);
        Session session = sessionService.getSession(sessionId);
        if (user.getRole() == RoleType.TEACHER) {
            if (!session.getTeacher().getId().equals(user.getId())) {
                throw new IllegalArgumentException("WebSocket session access denied");
            }
            return sessionId;
        }
        boolean isParticipant = sessionParticipantRepository.findBySessionAndUser(session, user).isPresent();
        boolean isGroupedStudent = groupMemberRepository.findFirstByUserAndGroup_SessionOrderByIdDesc(user, session).isPresent();
        if (!isParticipant && !isGroupedStudent) {
            throw new IllegalArgumentException("WebSocket session access denied");
        }
        return sessionId;
    }

    private Map<String, String> parseQuery(URI uri) {
        Map<String, String> query = new HashMap<String, String>();
        if (uri == null || uri.getQuery() == null || uri.getQuery().isEmpty()) {
            return query;
        }
        try {
            String[] pairs = uri.getQuery().split("&");
            for (String pair : pairs) {
                String[] parts = pair.split("=", 2);
                if (parts.length == 2) {
                    query.put(URLDecoder.decode(parts[0], "UTF-8"), URLDecoder.decode(parts[1], "UTF-8"));
                }
            }
        } catch (java.io.UnsupportedEncodingException e) {
            throw new RuntimeException(e);
        }
        return query;
    }
}
