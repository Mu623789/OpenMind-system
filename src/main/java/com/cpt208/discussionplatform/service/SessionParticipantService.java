package com.cpt208.discussionplatform.service;

import com.cpt208.discussionplatform.entity.Session;
import com.cpt208.discussionplatform.entity.SessionParticipant;
import com.cpt208.discussionplatform.entity.User;
import com.cpt208.discussionplatform.enums.RoleType;
import com.cpt208.discussionplatform.enums.SessionStatus;
import com.cpt208.discussionplatform.repository.SessionParticipantRepository;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SessionParticipantService {

    private final SessionParticipantRepository sessionParticipantRepository;
    private final SessionService sessionService;
    private final UserService userService;

    public SessionParticipantService(SessionParticipantRepository sessionParticipantRepository,
                                     SessionService sessionService,
                                     UserService userService) {
        this.sessionParticipantRepository = sessionParticipantRepository;
        this.sessionService = sessionService;
        this.userService = userService;
    }

    @Transactional
    public void joinSession(Long sessionId, Long userId) {
        Session session = sessionService.getSession(sessionId);
        User user = userService.getUser(userId);
        if (user.getRole() != RoleType.STUDENT) {
            throw new IllegalArgumentException("Only students can join the waiting room");
        }
        if (session.getStatus() != SessionStatus.CREATED && session.getStatus() != SessionStatus.GROUPED) {
            throw new IllegalArgumentException("This session is no longer open for the waiting room");
        }
        if (sessionParticipantRepository.findBySessionAndUser(session, user).isPresent()) {
            return;
        }
        SessionParticipant participant = new SessionParticipant();
        participant.setSession(session);
        participant.setUser(user);
        try {
            sessionParticipantRepository.save(participant);
        } catch (DataIntegrityViolationException ex) {
            if (sessionParticipantRepository.findBySessionAndUser(session, user).isPresent()) {
                return;
            }
            throw ex;
        }
    }

    public List<User> getParticipants(Session session) {
        return sessionParticipantRepository.findBySession(session)
            .stream()
            .map(SessionParticipant::getUser)
            .collect(Collectors.toList());
    }

    public long getParticipantCountForUser(Long sessionId, Long userId) {
        Session session = sessionService.getSession(sessionId);
        User user = userService.getUser(userId);
        if (!sessionParticipantRepository.findBySessionAndUser(session, user).isPresent()) {
            throw new IllegalArgumentException("User is not in the waiting room for this session");
        }
        return sessionParticipantRepository.countBySession(session);
    }

    public List<User> getStudentParticipants(Long sessionId) {
        Session session = sessionService.getSession(sessionId);
        return getParticipants(session)
            .stream()
            .filter(user -> user.getRole() == RoleType.STUDENT)
            .collect(Collectors.toList());
    }

    @Transactional
    public void clearParticipants(Session session) {
        sessionParticipantRepository.deleteBySession(session);
    }

    @Transactional
    public void acknowledgeGroupReady(Long sessionId, Long userId) {
        Session session = sessionService.getSession(sessionId);
        User user = userService.getUser(userId);
        if (session.getStatus() != SessionStatus.GROUPED) {
            throw new IllegalArgumentException("Group ready acknowledgement is only available before the session starts");
        }
        if (!sessionParticipantRepository.findBySessionAndUser(session, user).isPresent()) {
            throw new IllegalArgumentException("User is not in the waiting room for this session");
        }
        sessionParticipantRepository.acknowledgeGroupReady(session, user, LocalDateTime.now());
    }

    @Transactional
    public void resetGroupReadyAcknowledgements(Long sessionId) {
        Session session = sessionService.getSession(sessionId);
        sessionParticipantRepository.clearGroupReadyAcknowledgedAtBySession(session);
    }

    public long getGroupReadyAcknowledgementCount(Long sessionId) {
        Session session = sessionService.getSession(sessionId);
        return sessionParticipantRepository.countBySessionAndGroupReadyAcknowledgedAtIsNotNull(session);
    }

    public Set<Long> getGroupReadyAcknowledgedUserIds(Long sessionId) {
        Session session = sessionService.getSession(sessionId);
        return sessionParticipantRepository.findBySessionAndGroupReadyAcknowledgedAtIsNotNull(session)
            .stream()
            .map(item -> item.getUser().getId())
            .collect(Collectors.toCollection(HashSet::new));
    }

    public boolean isGroupReadyAcknowledged(Long sessionId, Long userId) {
        return getGroupReadyAcknowledgedUserIds(sessionId).contains(userId);
    }
}
