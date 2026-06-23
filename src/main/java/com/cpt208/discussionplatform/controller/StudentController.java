package com.cpt208.discussionplatform.controller;

import com.cpt208.discussionplatform.dto.request.StartSpeakingRequest;
import com.cpt208.discussionplatform.dto.request.StopSpeakingRequest;
import com.cpt208.discussionplatform.dto.request.UpdateAvatarRequest;
import com.cpt208.discussionplatform.dto.request.UpdatePersonalityRequest;
import com.cpt208.discussionplatform.dto.request.JoinSessionRequest;
import com.cpt208.discussionplatform.dto.response.ApiResponse;
import com.cpt208.discussionplatform.dto.response.GroupResponse;
import com.cpt208.discussionplatform.dto.response.UserProfileResponse;
import com.cpt208.discussionplatform.entity.DiscussionGroup;
import com.cpt208.discussionplatform.entity.Session;
import com.cpt208.discussionplatform.entity.SessionParticipant;
import com.cpt208.discussionplatform.entity.SpeakingLog;
import com.cpt208.discussionplatform.entity.User;
import com.cpt208.discussionplatform.repository.SessionParticipantRepository;
import com.cpt208.discussionplatform.repository.SpeakingLogRepository;
import com.cpt208.discussionplatform.service.AiGuideService;
import com.cpt208.discussionplatform.service.DiscussionService;
import com.cpt208.discussionplatform.service.GroupService;
import com.cpt208.discussionplatform.service.SessionAnalyticsService;
import com.cpt208.discussionplatform.service.SessionParticipantService;
import com.cpt208.discussionplatform.service.SessionService;
import com.cpt208.discussionplatform.service.UserService;
import javax.validation.Valid;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/students")
public class StudentController {

    private final UserService userService;
    private final GroupService groupService;
    private final AiGuideService aiGuideService;
    private final SessionService sessionService;
    private final DiscussionService discussionService;
    private final SessionParticipantService sessionParticipantService;
    private final SessionAnalyticsService sessionAnalyticsService;
    private final SpeakingLogRepository speakingLogRepository;
    private final SessionParticipantRepository sessionParticipantRepository;

    public StudentController(UserService userService,
                             GroupService groupService,
                             AiGuideService aiGuideService,
                             SessionService sessionService,
                             DiscussionService discussionService,
                             SessionParticipantService sessionParticipantService,
                             SessionAnalyticsService sessionAnalyticsService,
                             SpeakingLogRepository speakingLogRepository,
                             SessionParticipantRepository sessionParticipantRepository) {
        this.userService = userService;
        this.groupService = groupService;
        this.aiGuideService = aiGuideService;
        this.sessionService = sessionService;
        this.discussionService = discussionService;
        this.sessionParticipantService = sessionParticipantService;
        this.sessionAnalyticsService = sessionAnalyticsService;
        this.speakingLogRepository = speakingLogRepository;
        this.sessionParticipantRepository = sessionParticipantRepository;
    }

    @PostMapping("/personality")
    public ResponseEntity<ApiResponse<UserProfileResponse>> updatePersonality(@Valid @RequestBody UpdatePersonalityRequest request) {
        return ResponseEntity.ok(ApiResponse.ok("Profile updated", userService.updatePersonality(getCurrentUserId(), request.getPersonality())));
    }

    @PostMapping("/avatar")
    public ResponseEntity<ApiResponse<UserProfileResponse>> updateAvatar(@Valid @RequestBody UpdateAvatarRequest request) {
        return ResponseEntity.ok(ApiResponse.ok("Avatar updated", userService.updateAvatar(getCurrentUserId(), request.getAvatar())));
    }

    @GetMapping("/group")
    public ResponseEntity<ApiResponse<GroupResponse>> getMyGroup(@RequestParam Long sessionId) {
        return ResponseEntity.ok(ApiResponse.ok("Query successful", groupService.getGroupByUserAndSession(getCurrentUserId(), sessionId)));
    }

    @PostMapping("/join-session")
    public ResponseEntity<ApiResponse<Void>> joinSession(@Valid @RequestBody JoinSessionRequest request) {
        sessionParticipantService.joinSession(request.getSessionId(), getCurrentUserId());
        return ResponseEntity.ok(ApiResponse.ok("Joined the waiting room", null));
    }

    @GetMapping("/waiting-room/count")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getWaitingRoomCount(@RequestParam Long sessionId) {
        long count = sessionParticipantService.getParticipantCountForUser(sessionId, getCurrentUserId());
        Map<String, Object> payload = new HashMap<String, Object>();
        payload.put("count", count);
        return ResponseEntity.ok(ApiResponse.ok("Query successful", payload));
    }

    @GetMapping("/ai-guide")
    public ResponseEntity<ApiResponse<Map<String, String>>> getGuide(
        @RequestParam Long sessionId,
        @RequestParam(required = false) Long groupId,
        @RequestParam String triggerType,
        @RequestParam(required = false, defaultValue = "Student") String targetName
    ) {
        GroupResponse group = groupService.getGroupByUserAndSession(getCurrentUserId(), sessionId);
        Map<String, String> payload = new HashMap<String, String>();
        payload.put("content", aiGuideService.generateGuide(
            sessionService.getSession(sessionId),
            groupService.getGroup(group.getGroupId()),
            triggerType,
            targetName
        ));
        return ResponseEntity.ok(ApiResponse.ok("Guide generated", payload));
    }

    @PostMapping("/group-ready/ack")
    public ResponseEntity<ApiResponse<Void>> acknowledgeGroupReady(@RequestParam Long sessionId) {
        sessionParticipantService.acknowledgeGroupReady(sessionId, getCurrentUserId());
        return ResponseEntity.ok(ApiResponse.ok("Group ready acknowledged", null));
    }

    @GetMapping("/session-result")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getSessionResult(@RequestParam Long sessionId) {
        groupService.getGroupByUserAndSession(getCurrentUserId(), sessionId);
        com.cpt208.discussionplatform.entity.Session session = sessionService.getSession(sessionId);
        if (session.getStatus() != com.cpt208.discussionplatform.enums.SessionStatus.ENDED) {
            throw new IllegalArgumentException("Session has not ended yet");
        }
        return ResponseEntity.ok(ApiResponse.ok("Query successful", sessionAnalyticsService.buildSessionResult(sessionId)));
    }

    @GetMapping("/speaking-log")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getSpeakingLog(@RequestParam Long sessionId) {
        GroupResponse group = groupService.getGroupByUserAndSession(getCurrentUserId(), sessionId);
        DiscussionGroup discussionGroup = groupService.getGroup(group.getGroupId());
        List<SpeakingLog> logs = speakingLogRepository.findByGroupOrderByStartTimeAsc(discussionGroup);
        List<Map<String, Object>> result = new ArrayList<Map<String, Object>>();
        for (SpeakingLog log : logs) {
            Map<String, Object> item = new HashMap<String, Object>();
            item.put("userId", log.getUser().getId());
            item.put("userName", log.getUser().getName());
            item.put("durationSeconds", log.getDurationSeconds());
            item.put("startTime", log.getStartTime());
            result.add(item);
        }
        return ResponseEntity.ok(ApiResponse.ok("Query successful", result));
    }

    @GetMapping("/my-sessions")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getMySessions() {
        Long userId = getCurrentUserId();
        User user = userService.getUser(userId);
        List<SessionParticipant> participations = sessionParticipantRepository.findByUserOrderByIdDesc(user);
        List<SpeakingLog> allLogs = speakingLogRepository.findByUser(user);
        List<Map<String, Object>> result = new ArrayList<Map<String, Object>>();
        for (SessionParticipant sp : participations) {
            Session session = sp.getSession();
            Map<String, Object> item = new HashMap<String, Object>();
            item.put("sessionId", session.getId());
            item.put("topic", session.getTopic());
            item.put("status", session.getStatus().name());
            item.put("teacherName", session.getTeacher().getName());
            item.put("createdAt", session.getCreatedAt());
            item.put("startedAt", session.getStartedAt());
            item.put("endedAt", session.getEndedAt());
            item.put("durationMinutes", session.getDurationMinutes());
            long speakingCount = 0;
            long totalSeconds = 0;
            for (SpeakingLog log : allLogs) {
                if (log.getGroup().getSession().getId().equals(session.getId())) {
                    speakingCount++;
                    totalSeconds += log.getDurationSeconds();
                }
            }
            item.put("speakingCount", speakingCount);
            item.put("totalSpeakingSeconds", totalSeconds);
            item.put("joinedAt", sp.getCreatedAt());
            result.add(item);
        }
        return ResponseEntity.ok(ApiResponse.ok("Query successful", result));
    }

    @PostMapping("/speaking/start")
    public ResponseEntity<ApiResponse<GroupResponse>> startSpeaking(@Valid @RequestBody StartSpeakingRequest request) {
        return ResponseEntity.ok(ApiResponse.ok("Speaking started", discussionService.startSpeaking(getCurrentUserId(), request.getSessionId())));
    }

    @PostMapping("/speaking/stop")
    public ResponseEntity<ApiResponse<GroupResponse>> stopSpeaking(@Valid @RequestBody StopSpeakingRequest request) {
        return ResponseEntity.ok(ApiResponse.ok("Speaking stopped", discussionService.stopSpeaking(getCurrentUserId(), request.getSessionId())));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiResponse<Void>> handleIllegalArgument(IllegalArgumentException ex) {
        return ResponseEntity.badRequest().body(ApiResponse.fail(ex.getMessage()));
    }

    private Long getCurrentUserId() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (!(principal instanceof User)) {
            throw new IllegalArgumentException("Current user is invalid");
        }
        return ((User) principal).getId();
    }
}
