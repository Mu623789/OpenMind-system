package com.cpt208.discussionplatform.dto.request;

import javax.validation.constraints.NotBlank;

public class AiChatRequest {

    @NotBlank
    private String message;

    private String page;

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public String getPage() { return page; }
    public void setPage(String page) { this.page = page; }
}
