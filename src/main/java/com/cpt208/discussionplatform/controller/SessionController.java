package com.cpt208.discussionplatform.controller;

import com.cpt208.discussionplatform.dto.request.CreateSessionRequest;
import com.cpt208.discussionplatform.dto.response.ApiResponse;
import com.cpt208.discussionplatform.dto.response.SessionResponse;
import com.cpt208.discussionplatform.service.SessionService;
import javax.validation.Valid;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/sessions")
public class SessionController {

    private final SessionService sessionService;

    public SessionController(SessionService sessionService) {
        this.sessionService = sessionService;
    }

    @PostMapping("/teacher/create")
    public ResponseEntity<ApiResponse<SessionResponse>> create(@Valid @RequestBody CreateSessionRequest request) {
        return ResponseEntity.ok(ApiResponse.ok("Session created", sessionService.create(request)));
    }

    @GetMapping("/teacher")
    public ResponseEntity<ApiResponse<List<SessionResponse>>> list() {
        return ResponseEntity.ok(ApiResponse.ok("Query successful", sessionService.listByTeacher()));
    }

    @GetMapping("/{sessionId}")
    public ResponseEntity<ApiResponse<SessionResponse>> getById(@PathVariable Long sessionId) {
        return ResponseEntity.ok(ApiResponse.ok("Query successful", sessionService.toResponse(sessionService.getSession(sessionId))));
    }

    @GetMapping("/open")
    public ResponseEntity<ApiResponse<List<SessionResponse>>> listOpenSessions() {
        return ResponseEntity.ok(ApiResponse.ok("Query successful", sessionService.listOpenSessions()));
    }

    @PostMapping("/teacher/{sessionId}/start")
    public ResponseEntity<ApiResponse<SessionResponse>> start(@PathVariable Long sessionId) {
        return ResponseEntity.ok(ApiResponse.ok("Session started", sessionService.markRunning(sessionId)));
    }

    @PostMapping("/teacher/{sessionId}/end")
    public ResponseEntity<ApiResponse<SessionResponse>> end(@PathVariable Long sessionId) {
        return ResponseEntity.ok(ApiResponse.ok("Session ended", sessionService.markEnded(sessionId)));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiResponse<Void>> handleIllegalArgument(IllegalArgumentException ex) {
        return ResponseEntity.badRequest().body(ApiResponse.fail(ex.getMessage()));
    }
}
