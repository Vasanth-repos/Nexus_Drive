package com.nexusdrive.common.exception;
import com.nexusdrive.common.dto.ErrorResponse; import jakarta.servlet.http.HttpServletRequest; import java.time.Instant; import java.util.*; import org.springframework.http.*; import org.springframework.security.access.AccessDeniedException; import org.springframework.web.bind.MethodArgumentNotValidException; import org.springframework.web.bind.annotation.*;
@RestControllerAdvice public class GlobalExceptionHandler {
 @ExceptionHandler(ResourceNotFoundException.class) ResponseEntity<ErrorResponse> notFound(RuntimeException e,HttpServletRequest r){return error(HttpStatus.NOT_FOUND,e,r,Map.of());}
 @ExceptionHandler(UnauthorizedException.class) ResponseEntity<ErrorResponse> unauthorized(RuntimeException e,HttpServletRequest r){return error(HttpStatus.UNAUTHORIZED,e,r,Map.of());}
 @ExceptionHandler({ValidationException.class,IllegalArgumentException.class}) ResponseEntity<ErrorResponse> bad(RuntimeException e,HttpServletRequest r){return error(HttpStatus.BAD_REQUEST,e,r,Map.of());}
 @ExceptionHandler(AccessDeniedException.class) ResponseEntity<ErrorResponse> denied(RuntimeException e,HttpServletRequest r){return error(HttpStatus.FORBIDDEN,e,r,Map.of());}
 @ExceptionHandler(MethodArgumentNotValidException.class) ResponseEntity<ErrorResponse> validation(MethodArgumentNotValidException e,HttpServletRequest r){Map<String,String> m=new LinkedHashMap<>();e.getBindingResult().getFieldErrors().forEach(x->m.put(x.getField(),x.getDefaultMessage()));return error(HttpStatus.BAD_REQUEST,e,r,m);}
 @ExceptionHandler(Exception.class) ResponseEntity<ErrorResponse> generic(Exception e,HttpServletRequest r){return error(HttpStatus.INTERNAL_SERVER_ERROR,e,r,Map.of());}
 private ResponseEntity<ErrorResponse> error(HttpStatus s,Exception e,HttpServletRequest r,Map<String,String> v){return ResponseEntity.status(s).body(new ErrorResponse(s.value(),s.getReasonPhrase(),e.getMessage(),r.getRequestURI(),Instant.now(),v));}
}
