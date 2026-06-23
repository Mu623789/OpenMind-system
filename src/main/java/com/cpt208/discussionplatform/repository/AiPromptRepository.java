package com.cpt208.discussionplatform.repository;

import com.cpt208.discussionplatform.entity.AiPrompt;
import com.cpt208.discussionplatform.entity.DiscussionGroup;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AiPromptRepository extends JpaRepository<AiPrompt, Long> {
    List<AiPrompt> findByGroupOrderByCreatedAtDesc(DiscussionGroup group);
    void deleteByGroupIn(List<DiscussionGroup> groups);
}
