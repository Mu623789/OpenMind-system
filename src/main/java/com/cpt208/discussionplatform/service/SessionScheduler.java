package com.cpt208.discussionplatform.service;

import com.cpt208.discussionplatform.entity.Session;
import com.cpt208.discussionplatform.enums.SessionStatus;
import com.cpt208.discussionplatform.repository.SessionRepository;
import java.time.LocalDateTime;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class SessionScheduler {

    private static final Logger log = LoggerFactory.getLogger(SessionScheduler.class);

    private final SessionRepository sessionRepository;
    private final SessionService sessionService;
    private final DiscussionService discussionService;
    private final GroupService groupService;

    public SessionScheduler(SessionRepository sessionRepository,
                             SessionService sessionService,
                             DiscussionService discussionService,
                             GroupService groupService) {
        this.sessionRepository = sessionRepository;
        this.sessionService = sessionService;
        this.discussionService = discussionService;
        this.groupService = groupService;
    }

    @Scheduled(fixedDelay = 5000)
    public void processScheduledSessions() {
        List<Session> groupedSessions = sessionRepository.findByStatus(SessionStatus.GROUPED);
        for (Session session : groupedSessions) {
            try {
                groupService.rebroadcastGroupReadyIfPending(session.getId());
            } catch (Exception ex) {
                log.warn("Failed to process grouped session task, sessionId={}", session.getId(), ex);
            }
        }

        List<Session> runningSessions = sessionRepository.findByStatus(SessionStatus.RUNNING);
        LocalDateTime now = LocalDateTime.now();
        for (Session session : runningSessions) {
            try {
                if (session.getStartedAt() == null || session.getDurationMinutes() == null) {
                    continue;
                }
                LocalDateTime expectedEnd = session.getStartedAt().plusMinutes(session.getDurationMinutes());
                if (!now.isBefore(expectedEnd)) {
                    sessionService.markEndedBySystem(session.getId());
                    continue;
                }
                discussionService.pushSilentGuides(session.getId());
            } catch (Exception ex) {
                log.warn("Failed to process scheduled session task, sessionId={}", session.getId(), ex);
            }
        }
    }
}
