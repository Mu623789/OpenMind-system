package com.cpt208.discussionplatform.dto.response;

import com.cpt208.discussionplatform.enums.PersonalityType;

public class GroupMemberResponse {

    private Long userId;
    private String name;
    private PersonalityType personality;
    private Long score;

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public PersonalityType getPersonality() { return personality; }
    public void setPersonality(PersonalityType personality) { this.personality = personality; }
    public Long getScore() { return score; }
    public void setScore(Long score) { this.score = score; }
}
