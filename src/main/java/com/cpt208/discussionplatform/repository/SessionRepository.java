package com.cpt208.discussionplatform.repository;

import com.cpt208.discussionplatform.entity.Session;
import com.cpt208.discussionplatform.entity.User;
import com.cpt208.discussionplatform.enums.SessionStatus;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SessionRepository extends JpaRepository<Session, Long> {
    List<Session> findByTeacherOrderByCreatedAtDesc(User teacher);
    List<Session> findByStatusInOrderByCreatedAtDesc(List<SessionStatus> statuses);
    List<Session> findByStatus(SessionStatus status);
}
