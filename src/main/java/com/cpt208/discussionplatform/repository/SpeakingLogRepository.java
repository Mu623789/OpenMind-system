package com.cpt208.discussionplatform.repository;

import com.cpt208.discussionplatform.entity.DiscussionGroup;
import com.cpt208.discussionplatform.entity.SpeakingLog;
import com.cpt208.discussionplatform.entity.User;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SpeakingLogRepository extends JpaRepository<SpeakingLog, Long> {
    List<SpeakingLog> findByGroup(DiscussionGroup group);
    List<SpeakingLog> findByGroupOrderByStartTimeAsc(DiscussionGroup group);
    List<SpeakingLog> findByGroupInOrderByStartTimeAsc(List<DiscussionGroup> groups);
    List<SpeakingLog> findByUser(User user);
    void deleteByGroupIn(List<DiscussionGroup> groups);
}
