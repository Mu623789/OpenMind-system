package com.cpt208.discussionplatform.dto.request;

import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;

public class CreateSessionRequest {

    @NotBlank
    private String topic;

    @NotNull
    @Min(1)
    private Integer durationMinutes;

    @NotNull
    @Min(2)
    @Max(6)
    private Integer groupSize;

    public String getTopic() { return topic; }
    public void setTopic(String topic) { this.topic = topic; }
    public Integer getDurationMinutes() { return durationMinutes; }
    public void setDurationMinutes(Integer durationMinutes) { this.durationMinutes = durationMinutes; }
    public Integer getGroupSize() { return groupSize; }
    public void setGroupSize(Integer groupSize) { this.groupSize = groupSize; }
}
