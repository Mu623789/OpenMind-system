package com.cpt208.discussionplatform.service;

import java.time.Instant;
import java.util.Iterator;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

@Service
public class TokenBlacklistService {

    private static final String KEY_PREFIX = "jwt:blacklist:";

    private final Optional<StringRedisTemplate> stringRedisTemplate;
    private final Map<String, Long> localBlacklist = new ConcurrentHashMap<>();

    public TokenBlacklistService(Optional<StringRedisTemplate> stringRedisTemplate) {
        this.stringRedisTemplate = stringRedisTemplate;
    }

    public void blacklist(String tokenId, long ttlSeconds) {
        if (ttlSeconds <= 0) {
            return;
        }
        try {
            if (stringRedisTemplate.isPresent()) {
                stringRedisTemplate.get().opsForValue().set(KEY_PREFIX + tokenId, "1", ttlSeconds, TimeUnit.SECONDS);
                return;
            }
        } catch (RedisConnectionFailureException ex) {
            // Fall back to local memory so development can run without Redis.
        }
        localBlacklist.put(tokenId, Instant.now().plusSeconds(ttlSeconds).toEpochMilli());
    }

    public boolean isBlacklisted(String tokenId) {
        try {
            if (stringRedisTemplate.isPresent()) {
                return Boolean.TRUE.equals(stringRedisTemplate.get().hasKey(KEY_PREFIX + tokenId));
            }
        } catch (RedisConnectionFailureException ex) {
            // Fall back to local memory so development can run without Redis.
        }
        removeExpiredLocalTokens();
        Long expiresAtMillis = localBlacklist.get(tokenId);
        return expiresAtMillis != null && expiresAtMillis > Instant.now().toEpochMilli();
    }

    private void removeExpiredLocalTokens() {
        long now = Instant.now().toEpochMilli();
        Iterator<Map.Entry<String, Long>> iterator = localBlacklist.entrySet().iterator();
        while (iterator.hasNext()) {
            if (iterator.next().getValue() <= now) {
                iterator.remove();
            }
        }
    }
}
