package com.cpt208.discussionplatform.service;

import com.cpt208.discussionplatform.dto.response.GroupResponse;
import com.cpt208.discussionplatform.entity.DiscussionGroup;
import com.cpt208.discussionplatform.entity.GroupMember;
import com.cpt208.discussionplatform.entity.Score;
import com.cpt208.discussionplatform.entity.Session;
import com.cpt208.discussionplatform.entity.SpeakingLog;
import com.cpt208.discussionplatform.entity.User;
import com.cpt208.discussionplatform.repository.DiscussionGroupRepository;
import com.cpt208.discussionplatform.repository.GroupMemberRepository;
import com.cpt208.discussionplatform.repository.ScoreRepository;
import com.cpt208.discussionplatform.repository.SpeakingLogRepository;
import com.cpt208.discussionplatform.websocket.DiscussionMessage;
import com.cpt208.discussionplatform.websocket.DiscussionSocketHandler;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Service;

@Service
public class DiscussionService {

    private final UserService userService;
    private final SessionService sessionService;
    private final GroupService groupService;
    private final GroupMemberRepository groupMemberRepository;
    private final SpeakingLogRepository speakingLogRepository;
    private final ScoreRepository scoreRepository;
    private final DiscussionSocketHandler discussionSocketHandler;
    private final DiscussionGroupRepository discussionGroupRepository;
    private final AiGuideService aiGuideService;
    private final Map<String, LocalDateTime> speakingTracker = new ConcurrentHashMap<>();
    private final Map<Long, LocalDateTime> groupLastActivityTracker = new ConcurrentHashMap<>();
    private final Map<Long, LocalDateTime> groupLastGuideTracker = new ConcurrentHashMap<>();
    private final Map<String, LocalDateTime> userLastActivityTracker = new ConcurrentHashMap<>();


    public DiscussionService(UserService userService,
                             SessionService sessionService,
                             GroupService groupService,
                             GroupMemberRepository groupMemberRepository,
                             SpeakingLogRepository speakingLogRepository,
                             ScoreRepository scoreRepository,
                             DiscussionSocketHandler discussionSocketHandler,
                             DiscussionGroupRepository discussionGroupRepository,
                             AiGuideService aiGuideService) {
        this.userService = userService;
        this.sessionService = sessionService;
        this.groupService = groupService;
        this.groupMemberRepository = groupMemberRepository;
        this.speakingLogRepository = speakingLogRepository;
        this.scoreRepository = scoreRepository;
        this.discussionSocketHandler = discussionSocketHandler;
        this.discussionGroupRepository = discussionGroupRepository;
        this.aiGuideService = aiGuideService;
    }

    public GroupResponse startSpeaking(Long userId, Long sessionId) {
        User user = userService.getUser(userId);
        Session session = sessionService.getSession(sessionId);
        if (session.getStatus() != com.cpt208.discussionplatform.enums.SessionStatus.RUNNING) {
            throw new IllegalArgumentException("Session is not running");
        }
        GroupMember member = groupMemberRepository.findFirstByUserAndGroup_SessionOrderByIdDesc(user, session)
            .orElseThrow(() -> new IllegalArgumentException("User has not been assigned to a group in this session"));
        String key = sessionId + "-" + userId;
        speakingTracker.put(key, LocalDateTime.now());
        touchActivity(sessionId, userId, member.getGroup().getId());
        broadcastSpeaking(session, member.getGroup(), user, true, getRanking(member.getGroup()));
        return groupService.getGroupByUserAndSession(userId, sessionId);
    }

    public GroupResponse stopSpeaking(Long userId, Long sessionId) {
        User user = userService.getUser(userId);
        Session session = sessionService.getSession(sessionId);
        if (session.getStatus() != com.cpt208.discussionplatform.enums.SessionStatus.RUNNING) {
            throw new IllegalArgumentException("Session is not running");
        }
        GroupMember member = groupMemberRepository.findFirstByUserAndGroup_SessionOrderByIdDesc(user, session)
            .orElseThrow(() -> new IllegalArgumentException("User has not been assigned to a group in this session"));
        String key = sessionId + "-" + userId;
        LocalDateTime start = speakingTracker.remove(key);
        if (start == null) {
            start = LocalDateTime.now();
        }
        long duration = Math.max(1, Duration.between(start, LocalDateTime.now()).getSeconds());

        SpeakingLog log = new SpeakingLog();
        log.setUser(user);
        log.setGroup(member.getGroup());
        log.setStartTime(start);
        log.setEndTime(LocalDateTime.now());
        log.setDurationSeconds(duration);
        speakingLogRepository.save(log);

        Score score = scoreRepository.findBySessionAndGroupAndUser(session, member.getGroup(), user)
            .orElseThrow(() -> new IllegalArgumentException("Score record not found"));
        score.setTotalScore(score.getTotalScore() + duration);
        scoreRepository.save(score);

        touchActivity(sessionId, userId, member.getGroup().getId());
        List<Map<String, Object>> ranking = getRanking(member.getGroup());
        broadcastSpeaking(session, member.getGroup(), user, false, ranking);
        return groupService.getGroupByUserAndSession(userId, sessionId);
    }

    public void pushSilentGuides(Long sessionId) {
        Session session = sessionService.getSession(sessionId);
        List<DiscussionGroup> groups = discussionGroupRepository.findBySession(session);
        LocalDateTime now = LocalDateTime.now();

        for (DiscussionGroup group : groups) {
            LocalDateTime lastGuide = groupLastGuideTracker.get(group.getId());
            if (lastGuide != null && Duration.between(lastGuide, now).getSeconds() < 30) {
                continue;
            }

            // GROUP_SILENT takes priority over SILENT_USER.
            LocalDateTime lastActivity = groupLastActivityTracker.get(group.getId());
            if (lastActivity == null) {
                lastActivity = session.getStartedAt();
            }
            if (lastActivity != null && Duration.between(lastActivity, now).getSeconds() >= 30) {
                String content = aiGuideService.generateGuide(session, group, "GROUP_SILENT", "Student");
                groupLastGuideTracker.put(group.getId(), now);
                broadcastGuide(session, group, content, "GROUP_SILENT");
                continue;
            }

            // SILENT_USER targets the first user who has been inactive for over 60 seconds and is not speaking.
            List<GroupMember> members = groupMemberRepository.findByGroup(group);
            for (GroupMember member : members) {
                String userKey = sessionId + "-" + member.getUser().getId();
                if (speakingTracker.containsKey(userKey)) {
                    continue;
                }
                LocalDateTime userLastActivity = userLastActivityTracker.get(userKey);
                if (userLastActivity == null) {
                    userLastActivity = session.getStartedAt();
                }
                if (userLastActivity == null || Duration.between(userLastActivity, now).getSeconds() < 60) {
                    continue;
                }
                String content = aiGuideService.generateGuide(session, group, "SILENT_USER", member.getUser().getName());
                userLastActivityTracker.put(userKey, now);
                groupLastGuideTracker.put(group.getId(), now);
                broadcastGuide(session, group, content, "SILENT_USER");
                break;
            }
        }
    }

    private void broadcastGuide(Session session, DiscussionGroup group, String content, String triggerType) {
        DiscussionMessage message = new DiscussionMessage();
        message.setType("AI_GUIDE");
        message.setSessionId(session.getId());
        message.setGroupId(group.getId());
        Map<String, Object> payload = new HashMap<>();
        payload.put("content", content);
        payload.put("triggerType", triggerType);
        message.setPayload(payload);
        discussionSocketHandler.broadcast(message);
    }

    private void touchActivity(Long sessionId, Long userId, Long groupId) {
        groupLastActivityTracker.put(groupId, LocalDateTime.now());
        userLastActivityTracker.put(sessionId + "-" + userId, LocalDateTime.now());
    }

    private void broadcastSpeaking(Session session, DiscussionGroup group, User user, boolean speaking, List<Map<String, Object>> ranking) {
        DiscussionMessage message = new DiscussionMessage();
        message.setType(speaking ? "SPEAKING_START" : "SPEAKING_END");
        message.setSessionId(session.getId());
        message.setGroupId(group.getId());
        Map<String, Object> payload = new HashMap<>();
        payload.put("userId", user.getId());
        payload.put("userName", user.getName());
        payload.put("speaking", speaking);
        message.setPayload(payload);
        message.setRanking(ranking);
        discussionSocketHandler.broadcast(message);
    }

    public List<Map<String, Object>> getRanking(DiscussionGroup group) {
        List<Score> scores = scoreRepository.findByGroupOrderByTotalScoreDesc(group);
        List<Map<String, Object>> ranking = new ArrayList<>();
        for (Score score : scores) {
            Map<String, Object> item = new HashMap<>();
            item.put("userId", score.getUser().getId());
            item.put("name", score.getUser().getName());
            item.put("score", score.getTotalScore());
            ranking.add(item);
        }
        return ranking;
    }

    public void clearSessionState(Long sessionId) {
        String prefix = sessionId + "-";
        speakingTracker.keySet().removeIf(key -> key.startsWith(prefix));
        userLastActivityTracker.keySet().removeIf(key -> key.startsWith(prefix));

        aiGuideService.clearHistory(sessionId);

        Session session = sessionService.getSession(sessionId);
        List<DiscussionGroup> groups = discussionGroupRepository.findBySession(session);
        for (DiscussionGroup group : groups) {
            groupLastActivityTracker.remove(group.getId());
            groupLastGuideTracker.remove(group.getId());
        }

        DiscussionMessage endMessage = new DiscussionMessage();
        endMessage.setType("SESSION_ENDED");
        endMessage.setSessionId(sessionId);
        Map<String, Object> endPayload = new HashMap<>();
        endPayload.put("sessionId", sessionId);
        endMessage.setPayload(endPayload);
        discussionSocketHandler.broadcast(endMessage);
    }

}
