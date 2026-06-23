package com.cpt208.discussionplatform.service;

import com.cpt208.discussionplatform.dto.response.UserProfileResponse;
import com.cpt208.discussionplatform.entity.User;
import com.cpt208.discussionplatform.enums.PersonalityType;
import com.cpt208.discussionplatform.repository.UserRepository;
import org.springframework.stereotype.Service;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final AuthService authService;

    public UserService(UserRepository userRepository, AuthService authService) {
        this.userRepository = userRepository;
        this.authService = authService;
    }

    public UserProfileResponse updatePersonality(Long userId, PersonalityType personality) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("User not found"));
        user.setPersonality(personality);
        return authService.toProfile(userRepository.save(user));
    }

    public UserProfileResponse updateAvatar(Long userId, String avatar) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("User not found"));
        user.setAvatar(normalizeAvatar(avatar));
        return authService.toProfile(userRepository.save(user));
    }

    public User getUser(Long userId) {
        return userRepository.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("User not found"));
    }

    private String normalizeAvatar(String avatar) {
        switch (avatar) {
            case "bat.png":
            case "bird.png":
            case "fox.png":
            case "giraffe.png":
            case "drawing.png":
            case "kitty.png":
                return avatar;
            default:
                throw new IllegalArgumentException("Invalid avatar");
        }
    }
}
