package com.cpt208.discussionplatform.controller;

import com.cpt208.discussionplatform.dto.request.AiChatRequest;
import com.cpt208.discussionplatform.dto.response.ApiResponse;
import com.cpt208.discussionplatform.service.AiGuideService;
import javax.validation.Valid;
import java.util.HashMap;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/ai")
public class AiChatController {

    private final AiGuideService aiGuideService;

    public AiChatController(AiGuideService aiGuideService) {
        this.aiGuideService = aiGuideService;
    }

    @PostMapping("/chat")
    public ResponseEntity<ApiResponse<Map<String, String>>> chat(@Valid @RequestBody AiChatRequest request) {
        Map<String, String> payload = new HashMap<String, String>();
        payload.put("content", aiGuideService.chat(request.getMessage(), request.getPage(), getCurrentRole()));
        return ResponseEntity.ok(ApiResponse.ok("AI response generated", payload));
    }

    private String getCurrentRole() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getAuthorities() == null) {
            return "USER";
        }
        return authentication.getAuthorities().toString();
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiResponse<Void>> handleIllegalArgument(IllegalArgumentException ex) {
        return ResponseEntity.badRequest().body(ApiResponse.fail(ex.getMessage()));
    }
}
