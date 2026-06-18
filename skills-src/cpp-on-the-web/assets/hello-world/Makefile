CC = emcc
CXX = em++

CFLAGS = -Wall -Werror -sSTRICT
CXXFLAGS = $(CFLAGS) --bind

# Output flags for modern web: ES6 module, modularized, minimal glue
LDFLAGS = -sEXPORT_ES6 \
          -sMODULARIZE \
          -sEXPORT_NAME=Module \
          -sALLOW_MEMORY_GROWTH \
          -sENVIRONMENT=web \
          --bind

TARGET = hello.mjs
SRCS = main.cpp
OBJS = $(SRCS:.cpp=.o)

all: $(TARGET)

# Link step
$(TARGET): $(OBJS)
	$(CXX) $(OBJS) $(LDFLAGS) -o $(TARGET)

# Compilation step (separate compilation)
%.o: %.cpp
	$(CXX) $(CXXFLAGS) -c $< -o $@

clean:
	rm -f $(TARGET) hello.wasm hello.mjs.map $(OBJS)

.PHONY: all clean
