package com.cpt208.discussionplatform.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final com.cpt208.discussionplatform.websocket.DiscussionSocketHandler discussionSocketHandler;

    public WebSocketConfig(com.cpt208.discussionplatform.websocket.DiscussionSocketHandler discussionSocketHandler) {
        this.discussionSocketHandler = discussionSocketHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(discussionSocketHandler, "/ws/discussion").setAllowedOrigins("*");
    }
}
