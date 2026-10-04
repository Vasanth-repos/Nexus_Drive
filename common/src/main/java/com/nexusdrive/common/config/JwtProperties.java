package com.nexusdrive.common.config;
import org.springframework.boot.context.properties.ConfigurationProperties;
@ConfigurationProperties(prefix="jwt")
public class JwtProperties { private String secret; private long accessExpirationMs=900000; private long refreshExpirationMs=604800000; public String getSecret(){return secret;} public void setSecret(String v){secret=v;} public long getAccessExpirationMs(){return accessExpirationMs;} public void setAccessExpirationMs(long v){accessExpirationMs=v;} public long getRefreshExpirationMs(){return refreshExpirationMs;} public void setRefreshExpirationMs(long v){refreshExpirationMs=v;} }
