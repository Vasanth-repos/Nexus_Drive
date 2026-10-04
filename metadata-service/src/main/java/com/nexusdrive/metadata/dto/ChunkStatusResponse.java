package com.nexusdrive.metadata.dto;import java.util.*;public record ChunkStatusResponse(UUID fileId,int expectedChunks,List<Integer> uploadedChunks,List<Integer> missingChunks,boolean complete){}
