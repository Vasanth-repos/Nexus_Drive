package com.nexusdrive.metadata.dto;import jakarta.validation.constraints.NotBlank;import java.util.UUID;public record FolderRequest(@NotBlank String name,UUID parentId){}
