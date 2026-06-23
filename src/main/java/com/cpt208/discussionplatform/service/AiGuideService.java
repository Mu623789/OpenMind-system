package com.cpt208.discussionplatform.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.cpt208.discussionplatform.entity.AiPrompt;
import com.cpt208.discussionplatform.entity.DiscussionGroup;
import com.cpt208.discussionplatform.entity.Session;
import com.cpt208.discussionplatform.repository.AiPromptRepository;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.client.SimpleClientHttpRequestFactory;

@Service
public class AiGuideService {

    private static final Logger log = LoggerFactory.getLogger(AiGuideService.class);

    private final AiPromptRepository aiPromptRepository;
    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;
    private final Map<String, List<String>> guideHistory = new ConcurrentHashMap<>();
    private static final int MAX_HISTORY = 5;

    @Value("${app.ai.api-key}")
    private String apiKey;

    @Value("${app.ai.api-url}")
    private String apiUrl;

    @Value("${app.ai.model:deepseek-chat}")
    private String model;

    public AiGuideService(AiPromptRepository aiPromptRepository,
                          ObjectMapper objectMapper) {
        this.aiPromptRepository = aiPromptRepository;
        this.objectMapper = objectMapper;
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(5000);
        requestFactory.setReadTimeout(15000);
        this.restTemplate = new RestTemplate(requestFactory);
    }

    public String generateGuide(Session session, DiscussionGroup group, String triggerType, String targetName) {
        String historyKey = session.getId() + "-" + group.getId();
        List<String> history = guideHistory.getOrDefault(historyKey, Collections.emptyList());
        String content;
        if (apiKey == null || apiKey.trim().isEmpty()) {
            content = buildLocalGuide(session.getTopic(), triggerType, targetName, history);
        } else {
            content = requestGuide(session.getTopic(), triggerType, targetName, history);
        }
        List<String> current = guideHistory.computeIfAbsent(historyKey, k -> Collections.synchronizedList(new ArrayList<>()));
        synchronized (current) {
            current.add(content);
            if (current.size() > MAX_HISTORY) {
                current.remove(0);
            }
        }
        AiPrompt prompt = new AiPrompt();
        prompt.setSession(session);
        prompt.setGroup(group);
        prompt.setTriggerType(triggerType);
        prompt.setContent(content);
        aiPromptRepository.save(prompt);
        return content;
    }

    public void clearHistory(Long sessionId) {
        String prefix = sessionId + "-";
        guideHistory.keySet().removeIf(key -> key.startsWith(prefix));
    }

    public String chat(String message, String page, String role) {
        if (message == null || message.trim().isEmpty()) {
            throw new IllegalArgumentException("Message is required");
        }
        String trimmed = message.trim();
        if (trimmed.length() > 600) {
            throw new IllegalArgumentException("Message is too long");
        }
        if (apiKey == null || apiKey.trim().isEmpty()) {
            return buildLocalChatAnswer(trimmed);
        }
        return requestChat(trimmed, page, role);
    }

    private String requestGuide(String topic, String triggerType, String targetName, List<String> history) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(apiKey.trim());

            Map<String, Object> request = new HashMap<String, Object>();
            request.put("model", model);
            request.put("temperature", 0.7D);

            List<Map<String, String>> messages = new ArrayList<Map<String, String>>();
            Map<String, String> systemMessage = new HashMap<String, String>();
            systemMessage.put("role", "system");
            systemMessage.put("content", buildSystemPrompt());
            messages.add(systemMessage);

            Map<String, String> userMessage = new HashMap<String, String>();
            userMessage.put("role", "user");
            userMessage.put("content", buildUserPrompt(topic, triggerType, targetName, history));
            messages.add(userMessage);

            request.put("messages", messages);

            ResponseEntity<String> response = restTemplate.postForEntity(
                apiUrl,
                new HttpEntity<Map<String, Object>>(request, headers),
                String.class
            );

            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                return buildLocalGuide(topic, triggerType, targetName, history);
            }

            JsonNode root = objectMapper.readTree(response.getBody());
            JsonNode contentNode = root.path("choices").path(0).path("message").path("content");
            String content = contentNode.isMissingNode() ? "" : contentNode.asText("").trim();
            if (content.isEmpty()) {
                return buildLocalGuide(topic, triggerType, targetName, history);
            }
            return content;
        } catch (Exception ex) {
            log.warn("DeepSeek guide generation failed", ex);
            return buildLocalGuide(topic, triggerType, targetName, history);
        }
    }

    private String requestChat(String message, String page, String role) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(apiKey.trim());

            Map<String, Object> request = new HashMap<String, Object>();
            request.put("model", model);
            request.put("temperature", 0.4D);

            List<Map<String, String>> messages = new ArrayList<Map<String, String>>();
            Map<String, String> systemMessage = new HashMap<String, String>();
            systemMessage.put("role", "system");
            systemMessage.put("content", buildChatSystemPrompt());
            messages.add(systemMessage);

            Map<String, String> userMessage = new HashMap<String, String>();
            userMessage.put("role", "user");
            userMessage.put("content", "Current page: " + safeText(page) + "\nUser role: " + safeText(role) + "\nQuestion: " + message);
            messages.add(userMessage);

            request.put("messages", messages);

            ResponseEntity<String> response = restTemplate.postForEntity(
                apiUrl,
                new HttpEntity<Map<String, Object>>(request, headers),
                String.class
            );

            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                return buildLocalChatAnswer(message);
            }

            JsonNode root = objectMapper.readTree(response.getBody());
            JsonNode contentNode = root.path("choices").path(0).path("message").path("content");
            String content = contentNode.isMissingNode() ? "" : contentNode.asText("").trim();
            if (content.isEmpty()) {
                return buildLocalChatAnswer(message);
            }
            return content;
        } catch (Exception ex) {
            log.warn("DeepSeek chat failed", ex);
            return buildLocalChatAnswer(message);
        }
    }

    private String buildSystemPrompt() {
        return "You are an AI classroom discussion facilitator. Generate exactly one concise guidance message in English for students. Keep it under 30 words, actionable, specific to the discussion topic, and suitable for immediate display in a fixed UI bubble.";
    }

    private String buildChatSystemPrompt() {
        return "You are OpenMind Buddy, a friendly assistant for the OpenMind classroom discussion platform. Answer in concise English. Help users understand login, registration, profile, waiting room, discussion room, speaking, AI guide, teacher dashboard, grouping, sessions, and results. If the question is unrelated to this system, politely steer back to OpenMind. Keep answers under 90 words.";
    }

    private String buildUserPrompt(String topic, String triggerType, String targetName, List<String> history) {
        StringBuilder sb = new StringBuilder();
        if (!history.isEmpty()) {
            sb.append("Previous guides already given (do NOT repeat similar content):\n");
            for (int i = 0; i < history.size(); i++) {
                sb.append(i + 1).append(". \"").append(history.get(i)).append("\"\n");
            }
            sb.append("\nNow generate a NEW, DIFFERENT guide:\n");
        }
        if ("SILENT_USER".equals(triggerType)) {
            sb.append("Topic: ").append(topic).append("\nTrigger: SILENT_USER\nTarget student: ").append(targetName).append("\nWrite one short prompt that directly invites this student to contribute one concrete idea.");
        } else if ("GROUP_SILENT".equals(triggerType)) {
            sb.append("Topic: ").append(topic).append("\nTrigger: GROUP_SILENT\nWrite one short follow-up question that helps the whole group continue the discussion immediately.");
        } else if ("SUMMARY".equals(triggerType)) {
            sb.append("Topic: ").append(topic).append("\nTrigger: SUMMARY\nWrite one short instruction that asks the group to summarize their main viewpoint in one sentence.");
        } else {
            sb.append("Topic: ").append(topic).append("\nWrite one short discussion prompt to keep the group talking.");
        }
        return sb.toString();
    }

    private static final String[][] LOCAL_TEMPLATES_SILENT_USER = {
        {"%s, please add one idea related to the topic \"%s\"."},
        {"%s, what is your perspective on \"%s\"?"},
        {"%s, can you share one example related to \"%s\"?"},
        {"%s, do you agree or disagree with the current points on \"%s\"?"},
        {"%s, what question do you have about \"%s\"?"}
    };
    private static final String[] LOCAL_TEMPLATES_GROUP_SILENT = {
        "Please share one direct thought about the topic \"%s\".",
        "What is one argument for or against the main idea of \"%s\"?",
        "Can someone give a real-world example related to \"%s\"?",
        "What aspect of \"%s\" hasn't been discussed yet?",
        "Try to challenge the most popular opinion about \"%s\"."
    };
    private static final String[] LOCAL_TEMPLATES_SUMMARY = {
        "Please summarize your main opinion about \"%s\" in one sentence.",
        "In one sentence, what is the group's consensus on \"%s\"?",
        "Wrap up: state your key takeaway from the discussion on \"%s\"."
    };
    private static final String[] LOCAL_TEMPLATES_DEFAULT = {
        "Please continue the discussion around the topic \"%s\".",
        "What new angle can you explore about \"%s\"?",
        "Build on the previous point about \"%s\" with your own view."
    };

    private String buildLocalGuide(String topic, String triggerType, String targetName, List<String> history) {
        int used = history.size();
        switch (triggerType) {
            case "SILENT_USER":
                return String.format(LOCAL_TEMPLATES_SILENT_USER[used % LOCAL_TEMPLATES_SILENT_USER.length][0], targetName, topic);
            case "GROUP_SILENT":
                return String.format(LOCAL_TEMPLATES_GROUP_SILENT[used % LOCAL_TEMPLATES_GROUP_SILENT.length], topic);
            case "SUMMARY":
                return String.format(LOCAL_TEMPLATES_SUMMARY[used % LOCAL_TEMPLATES_SUMMARY.length], topic);
            default:
                return String.format(LOCAL_TEMPLATES_DEFAULT[used % LOCAL_TEMPLATES_DEFAULT.length], topic);
        }
    }

    private String buildLocalChatAnswer(String message) {
        String lower = message.toLowerCase();
        if (lower.contains("join") || lower.contains("waiting")) {
            return "Open the Waiting Room, choose an open session, then click Join Mission. Keep the page open until your group is ready.";
        }
        if (lower.contains("avatar") || lower.contains("profile")) {
            return "Open Profile to view your avatar, name, email, and personality type. You can update your avatar and E/I choice there.";
        }
        if (lower.contains("speak") || lower.contains("microphone")) {
            return "In the Discussion Room, press and hold Hold to Speak while talking, then release when your turn is finished.";
        }
        if (lower.contains("teacher") || lower.contains("session")) {
            return "Teachers can create sessions, group students, start discussions, monitor progress, and view results from the Teacher Dashboard.";
        }
        return "I can help with OpenMind features such as registration, profile, waiting room, discussion room, speaking logs, sessions, grouping, and results.";
    }

    private String safeText(String value) {
        return value == null ? "-" : value;
    }
}
