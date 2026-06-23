package com.cpt208.discussionplatform.repository;

import com.cpt208.discussionplatform.entity.DiscussionGroup;
import com.cpt208.discussionplatform.entity.Session;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DiscussionGroupRepository extends JpaRepository<DiscussionGroup, Long> {
    List<DiscussionGroup> findBySession(Session session);
    void deleteBySession(Session session);
}
