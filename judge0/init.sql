-- Ensure Java 13 uses compact JVM memory settings for sandbox execution
UPDATE languages 
SET compile_cmd = '/usr/local/openjdk13/bin/javac -J-XX:MaxMetaspaceSize=64m -J-XX:CompressedClassSpaceSize=32m -J-Xms16m -J-Xmx64m %s Main.java', 
    run_cmd = '/usr/local/openjdk13/bin/java -XX:MaxMetaspaceSize=64m -XX:CompressedClassSpaceSize=32m -Xms16m -Xmx128m Main %s' 
WHERE id = 62;
