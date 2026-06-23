package com.cpt208.discussionplatform.service;

import com.cpt208.discussionplatform.dto.response.GroupMemberResponse;
import com.cpt208.discussionplatform.dto.response.GroupResponse;
import com.cpt208.discussionplatform.entity.DiscussionGroup;
import com.cpt208.discussionplatform.entity.GroupMember;
import com.cpt208.discussionplatform.entity.Score;
import com.cpt208.discussionplatform.entity.Session;
import com.cpt208.discussionplatform.entity.User;
import com.cpt208.discussionplatform.repository.AiPromptRepository;
import com.cpt208.discussionplatform.websocket.DiscussionMessage;
import com.cpt208.discussionplatform.websocket.DiscussionSocketHandler;
import com.cpt208.discussionplatform.enums.PersonalityType;
import com.cpt208.discussionplatform.enums.SessionStatus;
import com.cpt208.discussionplatform.repository.DiscussionGroupRepository;
import com.cpt208.discussionplatform.repository.GroupMemberRepository;
import com.cpt208.discussionplatform.repository.ScoreRepository;
import com.cpt208.discussionplatform.repository.SessionRepository;
import com.cpt208.discussionplatform.repository.SpeakingLogRepository;
import com.cpt208.discussionplatform.repository.UserRepository;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class GroupService {

    private final SessionService sessionService;
    private final UserRepository userRepository;
    private final DiscussionGroupRepository discussionGroupRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final ScoreRepository scoreRepository;
    private final SessionRepository sessionRepository;
    private final SpeakingLogRepository speakingLogRepository;
    private final AiPromptRepository aiPromptRepository;
    private final SessionParticipantService sessionParticipantService;
    private final DiscussionSocketHandler discussionSocketHandler;

    private static final int MIN_GROUP_SIZE = 2;
    private static final int MAX_GROUP_SIZE = 6;

    public GroupService(SessionService sessionService,
                        UserRepository userRepository,
                        DiscussionGroupRepository discussionGroupRepository,
                        GroupMemberRepository groupMemberRepository,
                        ScoreRepository scoreRepository,
                        SessionRepository sessionRepository,
                        SpeakingLogRepository speakingLogRepository,
                        AiPromptRepository aiPromptRepository,
                        SessionParticipantService sessionParticipantService,
                        DiscussionSocketHandler discussionSocketHandler) {
        this.sessionService = sessionService;
        this.userRepository = userRepository;
        this.discussionGroupRepository = discussionGroupRepository;
        this.groupMemberRepository = groupMemberRepository;
        this.scoreRepository = scoreRepository;
        this.sessionRepository = sessionRepository;
        this.speakingLogRepository = speakingLogRepository;
        this.aiPromptRepository = aiPromptRepository;
        this.sessionParticipantService = sessionParticipantService;
        this.discussionSocketHandler = discussionSocketHandler;
    }

    @Transactional
    public List<GroupResponse> autoGroup(Long sessionId) {
        Session session = sessionService.getTeacherOwnedSession(sessionId);
        if (session.getStatus() != SessionStatus.CREATED && session.getStatus() != SessionStatus.GROUPED) {
            throw new IllegalArgumentException("Only created or grouped sessions can be auto grouped");
        }
        sessionParticipantService.resetGroupReadyAcknowledgements(sessionId);
        clearExistingGroups(session);

        List<User> students = sessionParticipantService.getParticipants(session).stream()
            .filter(user -> user.getRole().name().equals("STUDENT"))
            .sorted(Comparator.comparing(User::getId))
            .collect(Collectors.toList());

        if (students.isEmpty()) {
            throw new IllegalArgumentException("No students are currently in the waiting room");
        }

        List<User> extroverts = students.stream()
            .filter(user -> user.getPersonality() == PersonalityType.E)
            .collect(Collectors.toCollection(ArrayList::new));
        List<User> introverts = students.stream()
            .filter(user -> user.getPersonality() == PersonalityType.I)
            .collect(Collectors.toCollection(ArrayList::new));
        List<User> unknown = students.stream()
            .filter(user -> user.getPersonality() == null)
            .collect(Collectors.toCollection(ArrayList::new));

        List<List<User>> buckets = new ArrayList<>();
        int groupSize = session.getGroupSize();
        int groupCount = determineGroupCount(students.size(), groupSize);
        for (int i = 0; i < groupCount; i++) {
            buckets.add(new ArrayList<>());
        }

        distribute(extroverts, buckets);
        distribute(introverts, buckets);
        distribute(unknown, buckets);

        List<GroupResponse> responses = new ArrayList<>();
        List<GroupMember> membersToSave = new ArrayList<>();
        List<Score> scoresToSave = new ArrayList<>();

        for (int i = 0; i < buckets.size(); i++) {
            DiscussionGroup group = new DiscussionGroup();
            group.setSession(session);
            group.setName("Group " + (i + 1));
            DiscussionGroup savedGroup = discussionGroupRepository.save(group);

            GroupResponse response = new GroupResponse();
            response.setGroupId(savedGroup.getId());
            response.setSessionId(session.getId());
            response.setGroupName(savedGroup.getName());

            for (User user : buckets.get(i)) {
                GroupMember member = new GroupMember();
                member.setGroup(savedGroup);
                member.setUser(user);
                membersToSave.add(member);

                Score score = new Score();
                score.setSession(session);
                score.setGroup(savedGroup);
                score.setUser(user);
                score.setTotalScore(0L);
                scoresToSave.add(score);

                GroupMemberResponse memberResponse = new GroupMemberResponse();
                memberResponse.setUserId(user.getId());
                memberResponse.setName(user.getName());
                memberResponse.setPersonality(user.getPersonality());
                memberResponse.setScore(0L);
                response.getMembers().add(memberResponse);
            }
            responses.add(response);
        }
        
        groupMemberRepository.saveAll(membersToSave);
        scoreRepository.saveAll(scoresToSave);

        session.setStatus(SessionStatus.GROUPED);
        session.setGroupReadyLastBroadcastAt(LocalDateTime.now());
        session.setGroupReadyBroadcastUntil(LocalDateTime.now().plusMinutes(2));
        sessionRepository.save(session);
        broadcastGroupReady(session, students.size());
        return responses;
    }

    public boolean rebroadcastGroupReadyIfPending(Long sessionId) {
        Session session = sessionService.getSession(sessionId);
        if (session.getStatus() != SessionStatus.GROUPED || session.getGroupReadyBroadcastUntil() == null) {
            return false;
        }
        LocalDateTime now = LocalDateTime.now();
        if (!now.isBefore(session.getGroupReadyBroadcastUntil())) {
            session.setGroupReadyBroadcastUntil(null);
            sessionRepository.save(session);
            return false;
        }
        int participantCount = sessionParticipantService.getStudentParticipants(sessionId).size();
        long ackCount = sessionParticipantService.getGroupReadyAcknowledgementCount(sessionId);
        if (participantCount == 0 || ackCount >= participantCount) {
            session.setGroupReadyBroadcastUntil(null);
            sessionRepository.save(session);
            return false;
        }
        LocalDateTime lastBroadcastAt = session.getGroupReadyLastBroadcastAt();
        if (lastBroadcastAt != null && lastBroadcastAt.plusSeconds(5).isAfter(now)) {
            return false;
        }
        session.setGroupReadyLastBroadcastAt(now);
        sessionRepository.save(session);
        broadcastGroupReady(session, participantCount);
        return true;
    }

    private void broadcastGroupReady(Session session, int participantCount) {
        DiscussionMessage message = new DiscussionMessage();
        message.setType("GROUP_READY");
        message.setSessionId(session.getId());
        Map<String, Object> payload = new HashMap<String, Object>();
        payload.put("participantCount", participantCount);
        payload.put("ackCount", sessionParticipantService.getGroupReadyAcknowledgementCount(session.getId()));
        payload.put("pendingCount", Math.max(0, participantCount - sessionParticipantService.getGroupReadyAcknowledgementCount(session.getId())));
        message.setPayload(payload);
        discussionSocketHandler.broadcast(message);
    }

    public GroupResponse getGroupByUserAndSession(Long userId, Long sessionId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("User not found"));
        Session session = sessionService.getSession(sessionId);
        GroupMember member = groupMemberRepository.findFirstByUserAndGroup_SessionOrderByIdDesc(user, session)
            .orElseThrow(() -> new IllegalArgumentException("User has not been assigned to a group in this session"));
        return toResponse(member.getGroup());
    }

    public GroupResponse getGroupByUserAndSession(Long userId, Long groupId, Long sessionId) {
        GroupResponse response = getGroupByUserAndSession(userId, sessionId);
        if (!response.getGroupId().equals(groupId)) {
            throw new IllegalArgumentException("User does not belong to this group in the session");
        }
        return response;
    }

    public List<GroupResponse> getGroupsBySession(Long sessionId) {
        Session session = sessionService.getSession(sessionId);
        return discussionGroupRepository.findBySession(session)
            .stream()
            .map(this::toResponse)
            .collect(Collectors.toList());
    }

    public DiscussionGroup getGroup(Long groupId) {
        return discussionGroupRepository.findById(groupId)
            .orElseThrow(() -> new IllegalArgumentException("Group not found"));
    }

    public DiscussionGroup getGroupBySession(Long groupId, Long sessionId) {
        DiscussionGroup group = getGroup(groupId);
        Long currentSessionId = group.getSession().getId();
        if (!currentSessionId.equals(sessionId)) {
            throw new IllegalArgumentException("The group does not belong to this session");
        }
        return group;
    }

    @Transactional
    public GroupResponse moveMember(Long sessionId, Long userId, Long targetGroupId) {
        Session session = sessionService.getTeacherOwnedSession(sessionId);
        if (session.getStatus() != SessionStatus.CREATED && session.getStatus() != SessionStatus.GROUPED) {
            throw new IllegalArgumentException("Members can only be moved before the session starts");
        }
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("User not found"));
        DiscussionGroup targetGroup = getGroupBySession(targetGroupId, sessionId);
        GroupMember member = groupMemberRepository.findFirstByUserAndGroup_SessionOrderByIdDesc(user, session)
            .orElseThrow(() -> new IllegalArgumentException("User has not been assigned to a group in this session"));
        DiscussionGroup sourceGroup = member.getGroup();
        if (sourceGroup.getId().equals(targetGroup.getId())) {
            return toResponse(targetGroup);
        }
        int sourceSize = groupMemberRepository.findByGroup(sourceGroup).size();
        int targetSize = groupMemberRepository.findByGroup(targetGroup).size();
        if (sourceSize - 1 < MIN_GROUP_SIZE) {
            throw new IllegalArgumentException("Source group must keep at least " + MIN_GROUP_SIZE + " students");
        }
        if (targetSize + 1 > MAX_GROUP_SIZE) {
            throw new IllegalArgumentException("Target group cannot exceed " + MAX_GROUP_SIZE + " students");
        }
        member.setGroup(targetGroup);
        groupMemberRepository.save(member);
        Score score = scoreRepository.findBySessionAndGroupAndUser(session, sourceGroup, user)
            .orElseThrow(() -> new IllegalArgumentException("Score record not found"));
        score.setGroup(targetGroup);
        scoreRepository.save(score);
        if (session.getStatus() == SessionStatus.GROUPED) {
            sessionParticipantService.resetGroupReadyAcknowledgements(sessionId);
            session.setGroupReadyLastBroadcastAt(LocalDateTime.now());
            session.setGroupReadyBroadcastUntil(LocalDateTime.now().plusMinutes(2));
            sessionRepository.save(session);
            broadcastGroupReady(session, sessionParticipantService.getStudentParticipants(sessionId).size());
        }
        return toResponse(targetGroup);
    }

    private GroupResponse toResponse(DiscussionGroup group) {
        GroupResponse response = new GroupResponse();
        response.setGroupId(group.getId());
        response.setSessionId(group.getSession().getId());
        response.setGroupName(group.getName());
        List<GroupMember> members = groupMemberRepository.findByGroup(group);
        for (GroupMember groupMember : members) {
            GroupMemberResponse memberResponse = new GroupMemberResponse();
            memberResponse.setUserId(groupMember.getUser().getId());
            memberResponse.setName(groupMember.getUser().getName());
            memberResponse.setPersonality(groupMember.getUser().getPersonality());
            long score = scoreRepository.findBySessionAndGroupAndUser(group.getSession(), group, groupMember.getUser())
                .map(Score::getTotalScore)
                .orElse(0L);
            memberResponse.setScore(score);
            response.getMembers().add(memberResponse);
        }
        return response;
    }

    private void distribute(List<User> users, List<List<User>> buckets) {
        int index = 0;
        for (User user : users) {
            buckets.get(index % buckets.size()).add(user);
            index++;
        }
    }

    private int determineGroupCount(int studentCount, int preferredGroupSize) {
        int minGroupCount = (int) Math.ceil((double) studentCount / MAX_GROUP_SIZE);
        int maxGroupCount = studentCount / MIN_GROUP_SIZE;
        if (minGroupCount > maxGroupCount) {
            throw new IllegalArgumentException("Student count cannot be arranged into groups of " + MIN_GROUP_SIZE + " to " + MAX_GROUP_SIZE);
        }
        int selectedGroupCount = minGroupCount;
        double bestDistance = Double.MAX_VALUE;
        for (int candidate = minGroupCount; candidate <= maxGroupCount; candidate++) {
            double averageGroupSize = (double) studentCount / candidate;
            double distance = Math.abs(averageGroupSize - preferredGroupSize);
            if (distance < bestDistance) {
                bestDistance = distance;
                selectedGroupCount = candidate;
            }
        }
        return selectedGroupCount;
    }

    private void clearExistingGroups(Session session) {
        List<DiscussionGroup> existingGroups = discussionGroupRepository.findBySession(session);
        if (existingGroups.isEmpty()) {
            return;
        }
        aiPromptRepository.deleteByGroupIn(existingGroups);
        speakingLogRepository.deleteByGroupIn(existingGroups);
        scoreRepository.deleteByGroupIn(existingGroups);
        groupMemberRepository.deleteByGroupIn(existingGroups);
        discussionGroupRepository.deleteBySession(session);
    }
}
