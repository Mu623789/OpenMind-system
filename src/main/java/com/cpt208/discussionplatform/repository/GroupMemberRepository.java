package com.cpt208.discussionplatform.repository;

import com.cpt208.discussionplatform.entity.DiscussionGroup;
import com.cpt208.discussionplatform.entity.GroupMember;
import com.cpt208.discussionplatform.entity.Session;
import com.cpt208.discussionplatform.entity.User;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GroupMemberRepository extends JpaRepository<GroupMember, Long> {
    List<GroupMember> findByGroup(DiscussionGroup group);
    Optional<GroupMember> findFirstByUserOrderByIdDesc(User user);
    Optional<GroupMember> findFirstByUserAndGroup_SessionOrderByIdDesc(User user, Session session);
    List<GroupMember> findByGroupIn(List<DiscussionGroup> groups);
    void deleteByGroupIn(List<DiscussionGroup> groups);
}
