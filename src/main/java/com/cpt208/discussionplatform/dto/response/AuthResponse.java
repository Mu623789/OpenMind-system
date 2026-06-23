package com.cpt208.discussionplatform.dto.response;

public class AuthResponse {

    private String accessToken;
    private UserProfileResponse user;

    public String getAccessToken() {
        return accessToken;
    }

    public void setAccessToken(String accessToken) {
        this.accessToken = accessToken;
    }

    public UserProfileResponse getUser() {
        return user;
    }

    public void setUser(UserProfileResponse user) {
        this.user = user;
    }
}
