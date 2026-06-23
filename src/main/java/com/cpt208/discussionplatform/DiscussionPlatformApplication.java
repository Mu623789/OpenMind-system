package com.cpt208.discussionplatform;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class DiscussionPlatformApplication {

    public static void main(String[] args) {
        SpringApplication.run(DiscussionPlatformApplication.class, args);
    }
}
