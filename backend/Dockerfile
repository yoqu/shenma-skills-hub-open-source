FROM eclipse-temurin:17-jre

ENV TZ=Asia/Shanghai \
    JAVA_OPTS=""

WORKDIR /app
RUN mkdir -p /app/logs /data/skillstack/uploads

COPY target/*.jar /app/skillstack-backend.jar

EXPOSE 8080

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -Dspring.profiles.active=pro -jar /app/skillstack-backend.jar"]
