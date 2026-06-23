package com.cpt208.discussionplatform.repository;

import com.cpt208.discussionplatform.entity.DiscussionGroup;
import com.cpt208.discussionplatform.entity.Score;
import com.cpt208.discussionplatform.entity.Session;
import com.cpt208.discussionplatform.entity.User;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ScoreRepository extends JpaRepository<Score, Long> {
    Optional<Score> findBySessionAndGroupAndUser(Session session, DiscussionGroup group, User user);
    List<Score> findByGroupOrderByTotalScoreDesc(DiscussionGroup group);
    void deleteByGroupIn(List<DiscussionGroup> groups);
}
