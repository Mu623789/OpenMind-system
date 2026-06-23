package com.cpt208.discussionplatform.dto.request;

import javax.validation.constraints.NotNull;

public class MoveGroupMemberRequest {

    @NotNull
    private Long userId;

    @NotNull
    private Long targetGroupId;

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public Long getTargetGroupId() {
        return targetGroupId;
    }

    public void setTargetGroupId(Long targetGroupId) {
        this.targetGroupId = targetGroupId;
    }
}
