package com.cpt208.discussionplatform.websocket;

import java.util.List;
import java.util.Map;

public class DiscussionMessage {

    private String type;
    private Long sessionId;
    private Long groupId;
    private Map<String, Object> payload;
    private List<Map<String, Object>> ranking;

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public Long getSessionId() { return sessionId; }
    public void setSessionId(Long sessionId) { this.sessionId = sessionId; }
    public Long getGroupId() { return groupId; }
    public void setGroupId(Long groupId) { this.groupId = groupId; }
    public Map<String, Object> getPayload() { return payload; }
    public void setPayload(Map<String, Object> payload) { this.payload = payload; }
    public List<Map<String, Object>> getRanking() { return ranking; }
    public void setRanking(List<Map<String, Object>> ranking) { this.ranking = ranking; }
}
