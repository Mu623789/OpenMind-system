package com.cpt208.discussionplatform.service;

import com.cpt208.discussionplatform.dto.response.GroupResponse;
import com.cpt208.discussionplatform.entity.DiscussionGroup;
import com.cpt208.discussionplatform.entity.GroupMember;
import com.cpt208.discussionplatform.entity.Session;
import com.cpt208.discussionplatform.entity.SpeakingLog;
import com.cpt208.discussionplatform.entity.User;
import com.cpt208.discussionplatform.repository.DiscussionGroupRepository;
import com.cpt208.discussionplatform.repository.GroupMemberRepository;
import com.cpt208.discussionplatform.repository.SpeakingLogRepository;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public class SessionAnalyticsService {

    private final SessionService sessionService;
    private final GroupService groupService;
    private final DiscussionService discussionService;
    private final DiscussionGroupRepository discussionGroupRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final SpeakingLogRepository speakingLogRepository;
    private final SessionParticipantService sessionParticipantService;

    public SessionAnalyticsService(SessionService sessionService,
                                   GroupService groupService,
                                   DiscussionService discussionService,
                                   DiscussionGroupRepository discussionGroupRepository,
                                   GroupMemberRepository groupMemberRepository,
                                   SpeakingLogRepository speakingLogRepository,
                                   SessionParticipantService sessionParticipantService) {
        this.sessionService = sessionService;
        this.groupService = groupService;
        this.discussionService = discussionService;
        this.discussionGroupRepository = discussionGroupRepository;
        this.groupMemberRepository = groupMemberRepository;
        this.speakingLogRepository = speakingLogRepository;
        this.sessionParticipantService = sessionParticipantService;
    }

    public Map<String, Object> buildSessionOverview(Long sessionId) {
        Session session = sessionService.getSession(sessionId);
        List<User> waitingStudents = sessionParticipantService.getStudentParticipants(sessionId);
        Map<Long, Boolean> acknowledgedByUserId = new HashMap<Long, Boolean>();
        sessionParticipantService.getGroupReadyAcknowledgedUserIds(sessionId).forEach(functionalUserId -> {
            acknowledgedByUserId.put(functionalUserId, Boolean.TRUE);
        });
        List<DiscussionGroup> groups = discussionGroupRepository.findBySession(session);
        List<Map<String, Object>> groupSummaries = new ArrayList<Map<String, Object>>();
        long totalSpeakingSeconds = 0L;
        long totalMembers = 0L;

        for (DiscussionGroup group : groups) {
            List<GroupMember> members = groupMemberRepository.findByGroup(group);
            List<SpeakingLog> logs = speakingLogRepository.findByGroup(group);
            long groupSeconds = 0L;
            for (SpeakingLog log : logs) {
                groupSeconds += log.getDurationSeconds();
            }
            totalSpeakingSeconds += groupSeconds;
            totalMembers += members.size();

            Map<String, Object> item = new HashMap<String, Object>();
            item.put("groupId", group.getId());
            item.put("groupName", group.getName());
            item.put("memberCount", members.size());
            item.put("speakingSeconds", groupSeconds);
            item.put("ranking", discussionService.getRanking(group));
            groupSummaries.add(item);
        }

        Map<String, Object> response = new HashMap<String, Object>();
        response.put("sessionId", session.getId());
        response.put("topic", session.getTopic());
        response.put("status", session.getStatus());
        response.put("durationMinutes", session.getDurationMinutes());
        response.put("startedAt", session.getStartedAt());
        response.put("endedAt", session.getEndedAt());
        response.put("serverNow", LocalDateTime.now());
        if (session.getStartedAt() != null && session.getDurationMinutes() != null) {
            response.put("expectedEndAt", session.getStartedAt().plusMinutes(session.getDurationMinutes()));
        }
        response.put("waitingRoomCount", waitingStudents.size());
        response.put("groupCount", groups.size());
        response.put("participantCount", totalMembers);
        response.put("totalSpeakingSeconds", totalSpeakingSeconds);
        response.put("groupReadyAckCount", sessionParticipantService.getGroupReadyAcknowledgementCount(sessionId));
        response.put("groupReadyPendingCount", Math.max(0, waitingStudents.size() - sessionParticipantService.getGroupReadyAcknowledgementCount(sessionId)));
        response.put("groupReadyStudents", waitingStudents.stream().map(user -> {
            Map<String, Object> item = new HashMap<String, Object>();
            item.put("userId", user.getId());
            item.put("name", user.getName());
            item.put("personality", user.getPersonality());
            item.put("acknowledged", acknowledgedByUserId.containsKey(user.getId()));
            return item;
        }).collect(java.util.stream.Collectors.toList()));
        response.put("groups", groupSummaries);
        return response;
    }

    public List<Map<String, Object>> buildSpeakingTimeline(Long sessionId) {
        Session session = sessionService.getSession(sessionId);
        List<DiscussionGroup> groups = discussionGroupRepository.findBySession(session);
        List<SpeakingLog> logs = speakingLogRepository.findByGroupInOrderByStartTimeAsc(groups);
        List<Map<String, Object>> result = new ArrayList<Map<String, Object>>();
        for (SpeakingLog log : logs) {
            Map<String, Object> item = new HashMap<String, Object>();
            item.put("groupId", log.getGroup().getId());
            item.put("groupName", log.getGroup().getName());
            item.put("userId", log.getUser().getId());
            item.put("userName", log.getUser().getName());
            item.put("startTime", log.getStartTime());
            item.put("endTime", log.getEndTime());
            item.put("durationSeconds", log.getDurationSeconds());
            result.add(item);
        }
        return result;
    }

    public Map<String, Object> buildSessionResult(Long sessionId) {
        Session session = sessionService.getSession(sessionId);
        List<GroupResponse> groups = groupService.getGroupsBySession(sessionId);
        List<Map<String, Object>> memberRanking = new ArrayList<Map<String, Object>>();

        for (GroupResponse group : groups) {
            group.getMembers().forEach(member -> {
                Map<String, Object> item = new HashMap<String, Object>();
                item.put("groupId", group.getGroupId());
                item.put("groupName", group.getGroupName());
                item.put("userId", member.getUserId());
                item.put("name", member.getName());
                item.put("personality", member.getPersonality());
                item.put("score", member.getScore() == null ? 0L : member.getScore());
                memberRanking.add(item);
            });
        }

        memberRanking.sort((a, b) -> Long.compare(((Number) b.get("score")).longValue(), ((Number) a.get("score")).longValue()));

        Map<String, Object> response = new HashMap<String, Object>();
        response.put("sessionId", session.getId());
        response.put("topic", session.getTopic());
        response.put("status", session.getStatus());
        response.put("durationMinutes", session.getDurationMinutes());
        response.put("startedAt", session.getStartedAt());
        response.put("endedAt", session.getEndedAt());
        response.put("groups", groups);
        response.put("ranking", memberRanking);
        return response;
    }
}
