FROM node:24-bookworm AS policy
RUN apt-get update && apt-get install -y --no-install-recommends openjdk-17-jdk-headless ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /workspace
RUN corepack enable
COPY package.json yarn.lock .yarnrc.yml ./
RUN yarn install --immutable
COPY . .
CMD ["yarn", "test:scripts"]

FROM policy AS android
ARG COMMAND_LINE_TOOLS=11076708
ENV ANDROID_HOME=/opt/android-sdk \
    ANDROID_SDK_ROOT=/opt/android-sdk \
    JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 \
    NDK_HOME=/opt/android-sdk/ndk/27.2.12479018
ENV PATH="/root/.cargo/bin:/opt/android-sdk/cmdline-tools/latest/bin:/opt/android-sdk/platform-tools:/opt/android-sdk/emulator:${PATH}"
RUN apt-get update && apt-get install -y --no-install-recommends curl unzip build-essential pkg-config libssl-dev \
    && rm -rf /var/lib/apt/lists/*
RUN curl --fail --location --retry 3 "https://dl.google.com/android/repository/commandlinetools-linux-${COMMAND_LINE_TOOLS}_latest.zip" -o /tmp/tools.zip \
    && mkdir -p "$ANDROID_HOME/cmdline-tools" \
    && unzip -q /tmp/tools.zip -d "$ANDROID_HOME/cmdline-tools" \
    && mv "$ANDROID_HOME/cmdline-tools/cmdline-tools" "$ANDROID_HOME/cmdline-tools/latest" \
    && rm /tmp/tools.zip \
    && yes | sdkmanager --licenses > /dev/null
RUN sdkmanager 'platform-tools' 'build-tools;35.0.0' 'platforms;android-35' 'ndk;27.2.12479018'
RUN curl --fail --location --retry 3 https://sh.rustup.rs -o /tmp/rustup.sh \
    && sh /tmp/rustup.sh -y --profile minimal \
    && rm /tmp/rustup.sh \
    && rustup target add aarch64-linux-android x86_64-linux-android

FROM android AS emulator
RUN apt-get update && apt-get install -y --no-install-recommends libglu1-mesa libpulse0 libnss3 libx11-6 libxcb1 libxcomposite1 libxcursor1 libxi6 libxtst6 libxrandr2 libasound2 \
    && rm -rf /var/lib/apt/lists/*
RUN sdkmanager 'emulator' 'system-images;android-35;google_apis;x86_64' \
    && echo no | avdmanager create avd --force --name updater-test --package 'system-images;android-35;google_apis;x86_64'