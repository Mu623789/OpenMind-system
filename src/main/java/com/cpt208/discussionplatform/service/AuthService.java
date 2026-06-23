package com.cpt208.discussionplatform.service;

import java.util.Optional;
import com.cpt208.discussionplatform.dto.request.LoginRequest;
import com.cpt208.discussionplatform.dto.request.RegisterRequest;
import com.cpt208.discussionplatform.dto.response.AuthResponse;
import com.cpt208.discussionplatform.dto.response.UserProfileResponse;
import com.cpt208.discussionplatform.entity.User;
import com.cpt208.discussionplatform.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import javax.sql.DataSource;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final DataSource dataSource;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService, DataSource dataSource) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.dataSource = dataSource;
    }

    public AuthResponse register(RegisterRequest request) {
        userRepository.findByEmail(request.getEmail()).ifPresent(user -> {
            throw new IllegalArgumentException("Email is already registered");
        });
        User user = new User();
        user.setEmail(request.getEmail());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setName(request.getName());
        user.setRole(request.getRole());
        user.setAvatar(normalizeAvatar(request.getAvatar()));
        User savedUser = userRepository.save(user);
        return toAuthResponse(savedUser);
    }

    public AuthResponse login(LoginRequest request) {
        try (java.sql.Connection conn = dataSource.getConnection()) {
            System.out.println("jdbc url = " + conn.getMetaData().getURL());
            System.out.println("jdbc user = " + conn.getMetaData().getUserName());
            System.out.println("catalog = " + conn.getCatalog());
        } catch (Exception e) {
            e.printStackTrace();
        }

        System.out.println("login email = [" + request.getEmail() + "]");

        Optional<User> userOpt = userRepository.findByEmail(request.getEmail());
        System.out.println("query result present = " + userOpt.isPresent());

        User user = userOpt.orElseThrow(() ->
            new IllegalArgumentException("Account does not exist")
        );

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new IllegalArgumentException("Incorrect password");
        }

        return toAuthResponse(user);
    }

    public AuthResponse toAuthResponse(User user) {
        AuthResponse response = new AuthResponse();
        response.setAccessToken(jwtService.generateToken(user));
        response.setUser(toProfile(user));
        return response;
    }

    public UserProfileResponse toProfile(User user) {
        UserProfileResponse response = new UserProfileResponse();
        response.setId(user.getId());
        response.setEmail(user.getEmail());
        response.setName(user.getName());
        response.setRole(user.getRole());
        response.setPersonality(user.getPersonality());
        response.setAvatar(user.getAvatar());
        return response;
    }

    private String normalizeAvatar(String avatar) {
        if (avatar == null) {
            return null;
        }
        switch (avatar) {
            case "bat.png":
            case "bird.png":
            case "fox.png":
            case "giraffe.png":
            case "drawing.png":
            case "kitty.png":
                return avatar;
            default:
                return null;
        }
    }
}
