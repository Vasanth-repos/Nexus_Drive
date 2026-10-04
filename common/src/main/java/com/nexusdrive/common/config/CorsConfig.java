package com.nexusdrive.common.config;
import java.util.List; import org.springframework.context.annotation.*; import org.springframework.web.cors.*; import org.springframework.web.filter.CorsFilter;
@Configuration public class CorsConfig { @Bean CorsFilter corsFilter(){var c=new CorsConfiguration();c.setAllowedOriginPatterns(List.of("*"));c.setAllowedMethods(List.of("GET","POST","PUT","PATCH","DELETE","OPTIONS"));c.setAllowedHeaders(List.of("*"));c.setAllowCredentials(true);var s=new UrlBasedCorsConfigurationSource();s.registerCorsConfiguration("/**",c);return new CorsFilter(s);} }
