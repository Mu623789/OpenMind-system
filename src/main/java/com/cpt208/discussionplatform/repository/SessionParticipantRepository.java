package com.cpt208.discussionplatform.repository;

import com.cpt208.discussionplatform.entity.Session;
import com.cpt208.discussionplatform.entity.SessionParticipant;
import com.cpt208.discussionplatform.entity.User;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SessionParticipantRepository extends JpaRepository<SessionParticipant, Long> {
    List<SessionParticipant> findBySession(Session session);
    List<SessionParticipant> findByUserOrderByIdDesc(User user);
    Optional<SessionParticipant> findBySessionAndUser(Session session, User user);
    long countBySession(Session session);
    long countBySessionAndGroupReadyAcknowledgedAtIsNotNull(Session session);
    List<SessionParticipant> findBySessionAndGroupReadyAcknowledgedAtIsNotNull(Session session);
    void deleteBySession(Session session);

    @Modifying
    @Query("update SessionParticipant sp set sp.groupReadyAcknowledgedAt = null where sp.session = :session")
    void clearGroupReadyAcknowledgedAtBySession(@Param("session") Session session);

    @Modifying
    @Query("update SessionParticipant sp set sp.groupReadyAcknowledgedAt = :ackAt where sp.session = :session and sp.user = :user and sp.groupReadyAcknowledgedAt is null")
    int acknowledgeGroupReady(@Param("session") Session session, @Param("user") User user, @Param("ackAt") LocalDateTime ackAt);
}
