package com.cpt208.discussionplatform.dto.request;

import com.cpt208.discussionplatform.enums.PersonalityType;
import javax.validation.constraints.NotNull;

public class UpdatePersonalityRequest {

    @NotNull
    private PersonalityType personality;

    public PersonalityType getPersonality() { return personality; }
    public void setPersonality(PersonalityType personality) { this.personality = personality; }
}
