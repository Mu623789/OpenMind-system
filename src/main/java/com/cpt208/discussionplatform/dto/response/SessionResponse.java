package com.cpt208.discussionplatform.dto.response;

import com.cpt208.discussionplatform.enums.SessionStatus;
import java.time.LocalDateTime;

public class SessionResponse {

    private Long id;
    private String topic;
    private Integer durationMinutes;
    private Integer groupSize;
    private SessionStatus status;
    private Long teacherId;
    private String teacherName;
    private LocalDateTime createdAt;
    private LocalDateTime startedAt;
    private LocalDateTime endedAt;
    private LocalDateTime expectedEndAt;
    private LocalDateTime serverNow;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getTopic() { return topic; }
    public void setTopic(String topic) { this.topic = topic; }
    public Integer getDurationMinutes() { return durationMinutes; }
    public void setDurationMinutes(Integer durationMinutes) { this.durationMinutes = durationMinutes; }
    public Integer getGroupSize() { return groupSize; }
    public void setGroupSize(Integer groupSize) { this.groupSize = groupSize; }
    public SessionStatus getStatus() { return status; }
    public void setStatus(SessionStatus status) { this.status = status; }
    public Long getTeacherId() { return teacherId; }
    public void setTeacherId(Long teacherId) { this.teacherId = teacherId; }
    public String getTeacherName() { return teacherName; }
    public void setTeacherName(String teacherName) { this.teacherName = teacherName; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getStartedAt() { return startedAt; }
    public void setStartedAt(LocalDateTime startedAt) { this.startedAt = startedAt; }
    public LocalDateTime getEndedAt() { return endedAt; }
    public void setEndedAt(LocalDateTime endedAt) { this.endedAt = endedAt; }
    public LocalDateTime getExpectedEndAt() { return expectedEndAt; }
    public void setExpectedEndAt(LocalDateTime expectedEndAt) { this.expectedEndAt = expectedEndAt; }
    public LocalDateTime getServerNow() { return serverNow; }
    public void setServerNow(LocalDateTime serverNow) { this.serverNow = serverNow; }
}
