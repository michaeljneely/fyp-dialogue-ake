FROM openjdk:8-jdk-alpine 
RUN apk add --update --no-cache \unzip \wget 
RUN wget http://nlp.stanford.edu/software/stanford-corenlp-full-2018-01-31.zip 
RUN unzip stanford-corenlp-full-2018-01-31.zip && \rm stanford-corenlp-full-2018-01-31.zip
RUN wget https://nlp.stanford.edu/software/stanford-srparser-2014-10-23-models.jar
RUN mv ./stanford-srparser-2014-10-23-models.jar ./stanford-corenlp-full-2018-01-31/
WORKDIR stanford-corenlp-full-2018-01-31 
RUN export CLASSPATH="`find . -name '*.jar'`" 
ENV PORT 9000 
EXPOSE $PORT 
CMD java -cp "*" -mx4g edu.stanford.nlp.pipeline.StanfordCoreNLPServer -timeout 60000 -StanfordCoreNLP-english.properties -parse.model /u/nlp/data/srparser/englishSR.ser.gz -preload tokenize,ssplit,pos,lemma,ner
