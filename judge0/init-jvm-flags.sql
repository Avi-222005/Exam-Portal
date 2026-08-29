-- Ensure JVM languages (Java, Kotlin, Scala, Clojure, Groovy) have explicit
-- CompressedClassSpaceSize and MaxMetaspaceSize limits configured so they do
-- not attempt to allocate the default 1GB virtual memory metaspace on startup.

UPDATE languages SET 
  compile_cmd = '/usr/local/openjdk13/bin/javac -J-XX:CompressedClassSpaceSize=64m -J-XX:MaxMetaspaceSize=128m -J-Xmx256m %s Main.java',
  run_cmd = '/usr/local/openjdk13/bin/java -XX:CompressedClassSpaceSize=64m -XX:MaxMetaspaceSize=128m -Xmx256m Main'
WHERE id = 62;

UPDATE languages SET 
  compile_cmd = '/usr/local/kotlin-1.3.70/bin/kotlinc -J-XX:CompressedClassSpaceSize=64m -J-XX:MaxMetaspaceSize=128m -J-Xmx256m %s Main.kt',
  run_cmd = '/usr/local/kotlin-1.3.70/bin/kotlin -J-XX:CompressedClassSpaceSize=64m -J-XX:MaxMetaspaceSize=128m -J-Xmx256m MainKt'
WHERE id = 78;

UPDATE languages SET 
  compile_cmd = '/usr/local/scala-2.13.2/bin/scalac -J-XX:CompressedClassSpaceSize=64m -J-XX:MaxMetaspaceSize=128m -J-Xmx256m %s Main.scala',
  run_cmd = '/usr/local/scala-2.13.2/bin/scala -J-XX:CompressedClassSpaceSize=64m -XX:MaxMetaspaceSize=128m -J-Xmx256m Main'
WHERE id = 81;

UPDATE languages SET 
  run_cmd = '/usr/local/bin/java -XX:CompressedClassSpaceSize=64m -XX:MaxMetaspaceSize=128m -Xmx256m -jar /usr/local/clojure-1.10.1/clojure.jar main.clj'
WHERE id = 86;

UPDATE languages SET 
  compile_cmd = '/usr/local/groovy-3.0.3/bin/groovyc -J-XX:CompressedClassSpaceSize=64m -J-XX:MaxMetaspaceSize=128m -J-Xmx256m %s script.groovy',
  run_cmd = '/usr/local/bin/java -XX:CompressedClassSpaceSize=64m -XX:MaxMetaspaceSize=128m -Xmx256m -cp ".:/usr/local/groovy-3.0.3/lib/*" script'
WHERE id = 88;
