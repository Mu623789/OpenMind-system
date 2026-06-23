package com.cpt208.discussionplatform.service;

import com.cpt208.discussionplatform.entity.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Date;
import java.util.UUID;
import javax.annotation.PostConstruct;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class JwtService {

    @Value("${app.jwt.secret}")
    private String secret;

    @Value("${app.jwt.access-token-days}")
    private long accessTokenDays;

    private SecretKey secretKey;

    @PostConstruct
    public void init() {
        this.secretKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    public String generateToken(User user) {
        Date issuedAt = new Date();
        Date expiresAt = new Date(issuedAt.getTime() + Duration.ofDays(accessTokenDays).toMillis());
        return Jwts.builder()
            .setId(UUID.randomUUID().toString())
            .setSubject(String.valueOf(user.getId()))
            .claim("email", user.getEmail())
            .claim("role", user.getRole().name())
            .setIssuedAt(issuedAt)
            .setExpiration(expiresAt)
            .signWith(secretKey, SignatureAlgorithm.HS256)
            .compact();
    }

    public Claims parseToken(String token) {
        return Jwts.parserBuilder()
            .setSigningKey(secretKey)
            .build()
            .parseClaimsJws(token)
            .getBody();
    }

    public Long getUserId(String token) {
        return Long.valueOf(parseToken(token).getSubject());
    }

    public String getTokenId(String token) {
        return parseToken(token).getId();
    }

    public long getRemainingSeconds(String token) {
        Date expiration = parseToken(token).getExpiration();
        long remainingMillis = expiration.getTime() - System.currentTimeMillis();
        return Math.max(1L, remainingMillis / 1000L);
    }
}
