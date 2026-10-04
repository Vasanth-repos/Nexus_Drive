@echo off
setlocal
pushd "%~dp0"
set "PROJECT_DIR=%CD%"
set "WRAPPER_JAR=%PROJECT_DIR%\.mvn\wrapper\maven-wrapper.jar"
set "WRAPPER_MAIN=org.apache.maven.wrapper.MavenWrapperMain"
if not exist "%WRAPPER_JAR%" (
  echo Missing %WRAPPER_JAR%
  popd
  exit /b 1
)
"%JAVA_HOME%\bin\java.exe" -classpath "%WRAPPER_JAR%" "-Dmaven.multiModuleProjectDirectory=%PROJECT_DIR%" %WRAPPER_MAIN% %*
set "RESULT=%ERRORLEVEL%"
popd
exit /b %RESULT%
endlocal
