package com.cpt208.discussionplatform.dto.request;

import javax.validation.constraints.NotBlank;

public class UpdateAvatarRequest {

    @NotBlank
    private String avatar;

    public String getAvatar() { return avatar; }
    public void setAvatar(String avatar) { this.avatar = avatar; }
}
