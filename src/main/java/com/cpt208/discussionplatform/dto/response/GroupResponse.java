package com.cpt208.discussionplatform.dto.response;

import java.util.ArrayList;
import java.util.List;

public class GroupResponse {

    private Long groupId;
    private Long sessionId;
    private String groupName;
    private List<GroupMemberResponse> members = new ArrayList<>();

    public Long getGroupId() { return groupId; }
    public void setGroupId(Long groupId) { this.groupId = groupId; }
    public Long getSessionId() { return sessionId; }
    public void setSessionId(Long sessionId) { this.sessionId = sessionId; }
    public String getGroupName() { return groupName; }
    public void setGroupName(String groupName) { this.groupName = groupName; }
    public List<GroupMemberResponse> getMembers() { return members; }
    public void setMembers(List<GroupMemberResponse> members) { this.members = members; }
}
