package com.cpt208.discussionplatform.controller;

import com.cpt208.discussionplatform.dto.request.LoginRequest;
import com.cpt208.discussionplatform.dto.request.RegisterRequest;
import com.cpt208.discussionplatform.dto.response.ApiResponse;
import com.cpt208.discussionplatform.dto.response.AuthResponse;
import com.cpt208.discussionplatform.service.AuthService;
import com.cpt208.discussionplatform.service.JwtService;
import com.cpt208.discussionplatform.service.TokenBlacklistService;
import javax.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final JwtService jwtService;
    private final TokenBlacklistService tokenBlacklistService;

    public AuthController(AuthService authService,
                           JwtService jwtService,
                           TokenBlacklistService tokenBlacklistService) {
        this.authService = authService;
        this.jwtService = jwtService;
        this.tokenBlacklistService = tokenBlacklistService;
    }

    @PostMapping("/register")
    public ResponseEntity<ApiResponse<AuthResponse>> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.ok(ApiResponse.ok("Registration successful", authService.register(request)));
    }

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AuthResponse>> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(ApiResponse.ok("Login successful", authService.login(request)));
    }

    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<Void>> logout(@RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization) {
        if (authorization != null && authorization.startsWith("Bearer ")) {
            String token = authorization.substring(7);
            tokenBlacklistService.blacklist(jwtService.getTokenId(token), jwtService.getRemainingSeconds(token));
        }
        return ResponseEntity.ok(ApiResponse.ok("Logout successful", null));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiResponse<Void>> handleIllegalArgument(IllegalArgumentException ex) {
        return ResponseEntity.badRequest().body(ApiResponse.fail(ex.getMessage()));
    }
}
