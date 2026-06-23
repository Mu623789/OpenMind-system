package com.cpt208.discussionplatform.dto.request;

import javax.validation.constraints.NotNull;

public class StartSpeakingRequest {

    @NotNull
    private Long sessionId;

    public Long getSessionId() { return sessionId; }
    public void setSessionId(Long sessionId) { this.sessionId = sessionId; }
}
