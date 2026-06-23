package com.cpt208.discussionplatform.controller;

import com.cpt208.discussionplatform.dto.request.MoveGroupMemberRequest;
import com.cpt208.discussionplatform.dto.response.ApiResponse;
import com.cpt208.discussionplatform.dto.response.GroupResponse;
import com.cpt208.discussionplatform.entity.User;
import com.cpt208.discussionplatform.service.AiGuideService;
import com.cpt208.discussionplatform.service.GroupService;
import com.cpt208.discussionplatform.service.SessionAnalyticsService;
import com.cpt208.discussionplatform.service.SessionParticipantService;
import com.cpt208.discussionplatform.service.SessionService;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/teacher")
public class TeacherController {

    private final GroupService groupService;
    private final SessionService sessionService;
    private final AiGuideService aiGuideService;
    private final SessionParticipantService sessionParticipantService;
    private final SessionAnalyticsService sessionAnalyticsService;

    public TeacherController(GroupService groupService,
                              SessionService sessionService,
                              AiGuideService aiGuideService,
                              SessionParticipantService sessionParticipantService,
                              SessionAnalyticsService sessionAnalyticsService) {
        this.groupService = groupService;
        this.sessionService = sessionService;
        this.aiGuideService = aiGuideService;
        this.sessionParticipantService = sessionParticipantService;
        this.sessionAnalyticsService = sessionAnalyticsService;
    }

    @PostMapping("/sessions/{sessionId}/groups/auto")
    public ResponseEntity<ApiResponse<List<GroupResponse>>> autoGroup(@PathVariable Long sessionId) {
        return ResponseEntity.ok(ApiResponse.ok("Auto grouping completed", groupService.autoGroup(sessionId)));
    }

    @GetMapping("/sessions/{sessionId}/groups")
    public ResponseEntity<ApiResponse<List<GroupResponse>>> getGroups(@PathVariable Long sessionId) {
        sessionService.getTeacherOwnedSession(sessionId);
        return ResponseEntity.ok(ApiResponse.ok("Query successful", groupService.getGroupsBySession(sessionId)));
    }

    @PostMapping("/sessions/{sessionId}/groups/move-member")
    public ResponseEntity<ApiResponse<GroupResponse>> moveMember(@PathVariable Long sessionId,
                                                                  @RequestBody MoveGroupMemberRequest request) {
        return ResponseEntity.ok(ApiResponse.ok("Member moved", groupService.moveMember(sessionId, request.getUserId(), request.getTargetGroupId())));
    }

    @GetMapping("/sessions/{sessionId}/waiting-room/students")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getWaitingRoomStudents(@PathVariable Long sessionId) {
        sessionService.getTeacherOwnedSession(sessionId);
        List<User> students = sessionParticipantService.getStudentParticipants(sessionId);
        List<Map<String, Object>> payload = students.stream().map(user -> {
            Map<String, Object> item = new HashMap<String, Object>();
            item.put("id", user.getId());
            item.put("name", user.getName());
            item.put("personality", user.getPersonality());
            return item;
        }).collect(Collectors.toList());
        return ResponseEntity.ok(ApiResponse.ok("Query successful", payload));
    }

    @GetMapping("/sessions/{sessionId}/ai-guide")
    public ResponseEntity<ApiResponse<Map<String, String>>> getGuide(@PathVariable Long sessionId,
                                                                     @RequestParam Long groupId,
                                                                     @RequestParam String triggerType,
                                                                     @RequestParam(required = false, defaultValue = "Student") String targetName) {
        sessionService.getTeacherOwnedSession(sessionId);
        String content = aiGuideService.generateGuide(
            sessionService.getSession(sessionId),
            groupService.getGroupBySession(groupId, sessionId),
            triggerType,
            targetName
        );
        Map<String, String> response = new HashMap<String, String>();
        response.put("content", content);
        return ResponseEntity.ok(ApiResponse.ok("Guide generated", response));
    }

    @GetMapping("/sessions/{sessionId}/overview")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getSessionOverview(@PathVariable Long sessionId) {
        sessionService.getTeacherOwnedSession(sessionId);
        return ResponseEntity.ok(ApiResponse.ok("Query successful", sessionAnalyticsService.buildSessionOverview(sessionId)));
    }

    @GetMapping("/sessions/{sessionId}/speaking-logs")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getSpeakingLogs(@PathVariable Long sessionId) {
        sessionService.getTeacherOwnedSession(sessionId);
        return ResponseEntity.ok(ApiResponse.ok("Query successful", sessionAnalyticsService.buildSpeakingTimeline(sessionId)));
    }

    @GetMapping("/sessions/{sessionId}/result")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getSessionResult(@PathVariable Long sessionId) {
        sessionService.getTeacherOwnedSession(sessionId);
        return ResponseEntity.ok(ApiResponse.ok("Query successful", sessionAnalyticsService.buildSessionResult(sessionId)));
    }

    @GetMapping("/sessions/{sessionId}/result.csv")
    public ResponseEntity<String> exportSessionResultCsv(@PathVariable Long sessionId) {
        sessionService.getTeacherOwnedSession(sessionId);
        Map<String, Object> result = sessionAnalyticsService.buildSessionResult(sessionId);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> ranking = (List<Map<String, Object>>) result.get("ranking");
        List<Map<String, Object>> timeline = sessionAnalyticsService.buildSpeakingTimeline(sessionId);
        StringBuilder csv = new StringBuilder();

        csv.append("Session Info\n");
        csv.append("Topic,").append(safeCsv(result.get("topic"))).append('\n');
        csv.append("Status,").append(safeCsv(result.get("status"))).append('\n');
        csv.append("Duration (min),").append(safeCsv(result.get("durationMinutes"))).append('\n');
        csv.append("Started At,").append(safeCsv(result.get("startedAt"))).append('\n');
        csv.append("Ended At,").append(safeCsv(result.get("endedAt"))).append('\n');
        csv.append('\n');

        csv.append("Ranking\n");
        csv.append("Rank,Group,Name,Personality,Total Score (s)\n");
        for (int i = 0; i < ranking.size(); i++) {
            Map<String, Object> item = ranking.get(i);
            csv.append(i + 1).append(',')
                .append(safeCsv(item.get("groupName"))).append(',')
                .append(safeCsv(item.get("name"))).append(',')
                .append(safeCsv(item.get("personality"))).append(',')
                .append(item.get("score"))
                .append('\n');
        }
        csv.append('\n');

        csv.append("Speaking Log\n");
        csv.append("Group,Student,Start Time,End Time,Duration (s)\n");
        for (Map<String, Object> log : timeline) {
            csv.append(safeCsv(log.get("groupName"))).append(',')
                .append(safeCsv(log.get("userName"))).append(',')
                .append(safeCsv(log.get("startTime"))).append(',')
                .append(safeCsv(log.get("endTime"))).append(',')
                .append(safeCsv(log.get("durationSeconds")))
                .append('\n');
        }

        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=session-" + sessionId + "-result.csv")
            .contentType(MediaType.parseMediaType("text/csv"))
            .body(csv.toString());
    }

    private String safeCsv(Object value) {
        String text = value == null ? "" : String.valueOf(value);
        if (!text.isEmpty()) {
            char first = text.charAt(0);
            if (first == '=' || first == '+' || first == '-' || first == '@') {
                text = "'" + text;
            }
        }
        return '"' + text.replace("\"", "\"\"") + '"';
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiResponse<Void>> handleIllegalArgument(IllegalArgumentException ex) {
        return ResponseEntity.badRequest().body(ApiResponse.fail(ex.getMessage()));
    }
}
