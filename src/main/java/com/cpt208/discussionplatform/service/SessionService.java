package com.cpt208.discussionplatform.service;

import com.cpt208.discussionplatform.dto.request.CreateSessionRequest;
import com.cpt208.discussionplatform.dto.response.SessionResponse;
import com.cpt208.discussionplatform.entity.Session;
import com.cpt208.discussionplatform.entity.User;
import com.cpt208.discussionplatform.enums.RoleType;
import com.cpt208.discussionplatform.enums.SessionStatus;
import com.cpt208.discussionplatform.repository.SessionRepository;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;
import org.springframework.context.annotation.Lazy;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

@Service
public class SessionService {

    private final SessionRepository sessionRepository;
    private final UserService userService;
    private final DiscussionService discussionService;

    public SessionService(SessionRepository sessionRepository, UserService userService, @Lazy DiscussionService discussionService) {
        this.sessionRepository = sessionRepository;
        this.userService = userService;
        this.discussionService = discussionService;
    }

    public SessionResponse create(CreateSessionRequest request) {
        User teacher = getCurrentTeacher();
        validateGroupSize(request.getGroupSize());
        Session session = new Session();
        session.setTopic(request.getTopic());
        session.setDurationMinutes(request.getDurationMinutes());
        session.setGroupSize(request.getGroupSize());
        session.setTeacher(teacher);
        session.setStatus(SessionStatus.CREATED);
        session.setGroupReadyLastBroadcastAt(null);
        session.setGroupReadyBroadcastUntil(null);
        return toResponse(sessionRepository.save(session));
    }

    public List<SessionResponse> listByTeacher() {
        User teacher = getCurrentTeacher();
        return sessionRepository.findByTeacherOrderByCreatedAtDesc(teacher)
            .stream()
            .map(this::toResponse)
            .collect(Collectors.toList());
    }

    public List<SessionResponse> listOpenSessions() {
        return sessionRepository.findByStatusInOrderByCreatedAtDesc(
                Arrays.asList(SessionStatus.CREATED, SessionStatus.GROUPED))
            .stream()
            .map(this::toResponse)
            .collect(Collectors.toList());
    }

    public Session getSession(Long sessionId) {
        return sessionRepository.findById(sessionId)
            .orElseThrow(() -> new IllegalArgumentException("Session not found"));
    }

    public Session getTeacherOwnedSession(Long sessionId) {
        Session session = getSession(sessionId);
        User teacher = getCurrentTeacher();
        if (!session.getTeacher().getId().equals(teacher.getId())) {
            throw new IllegalArgumentException("You cannot access another teacher's session");
        }
        return session;
    }

    public SessionResponse markRunning(Long sessionId) {
        Session session = getTeacherOwnedSession(sessionId);
        if (session.getStatus() != SessionStatus.GROUPED) {
            throw new IllegalArgumentException("Only grouped sessions can be started");
        }
        session.setStatus(SessionStatus.RUNNING);
        session.setStartedAt(LocalDateTime.now());
        session.setGroupReadyLastBroadcastAt(null);
        session.setGroupReadyBroadcastUntil(null);
        return toResponse(sessionRepository.save(session));
    }

    public SessionResponse markEnded(Long sessionId) {
        Session session = getTeacherOwnedSession(sessionId);
        return markEndedInternal(session);
    }

    public SessionResponse markEndedBySystem(Long sessionId) {
        Session session = getSession(sessionId);
        return markEndedInternal(session);
    }

    private SessionResponse markEndedInternal(Session session) {
        if (session.getStatus() != SessionStatus.RUNNING) {
            throw new IllegalArgumentException("Only running sessions can be ended");
        }
        session.setStatus(SessionStatus.ENDED);
        session.setEndedAt(LocalDateTime.now());
        session.setGroupReadyLastBroadcastAt(null);
        session.setGroupReadyBroadcastUntil(null);
        SessionResponse response = toResponse(sessionRepository.save(session));
        discussionService.clearSessionState(session.getId());
        return response;
    }

    private void validateGroupSize(Integer groupSize) {
        if (groupSize == null || groupSize < 2 || groupSize > 6) {
            throw new IllegalArgumentException("Group size must be between 2 and 6");
        }
    }

    public SessionResponse toResponse(Session session) {
        LocalDateTime now = LocalDateTime.now();
        SessionResponse response = new SessionResponse();
        response.setId(session.getId());
        response.setTopic(session.getTopic());
        response.setDurationMinutes(session.getDurationMinutes());
        response.setGroupSize(session.getGroupSize());
        response.setStatus(session.getStatus());
        response.setTeacherId(session.getTeacher().getId());
        response.setTeacherName(session.getTeacher().getName());
        response.setCreatedAt(session.getCreatedAt());
        response.setStartedAt(session.getStartedAt());
        response.setEndedAt(session.getEndedAt());
        response.setServerNow(now);
        if (session.getStartedAt() != null && session.getDurationMinutes() != null) {
            response.setExpectedEndAt(session.getStartedAt().plusMinutes(session.getDurationMinutes()));
        }
        return response;
    }

    private User getCurrentTeacher() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (!(principal instanceof User)) {
            throw new IllegalArgumentException("Current user is invalid");
        }
        User user = (User) principal;
        if (user.getRole() != RoleType.TEACHER) {
            throw new IllegalArgumentException("Current user is not a teacher");
        }
        return user;
    }
}
