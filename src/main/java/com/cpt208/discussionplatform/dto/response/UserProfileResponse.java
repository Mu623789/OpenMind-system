package com.cpt208.discussionplatform.dto.response;

import com.cpt208.discussionplatform.enums.PersonalityType;
import com.cpt208.discussionplatform.enums.RoleType;

public class UserProfileResponse {

    private Long id;
    private String email;
    private String name;
    private RoleType role;
    private PersonalityType personality;
    private String avatar;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public RoleType getRole() { return role; }
    public void setRole(RoleType role) { this.role = role; }
    public PersonalityType getPersonality() { return personality; }
    public void setPersonality(PersonalityType personality) { this.personality = personality; }
    public String getAvatar() { return avatar; }
    public void setAvatar(String avatar) { this.avatar = avatar; }
}
