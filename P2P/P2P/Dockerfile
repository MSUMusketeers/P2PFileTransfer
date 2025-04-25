# Base image
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 8080

# Build image
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy all files from the current folder (which contains P2P.csproj)
COPY . .

# Use relative path since P2P.csproj is in current dir
RUN dotnet restore "./P2P.csproj"
RUN dotnet build "./P2P.csproj" -c Release -o /app/build

# Publish image
FROM build AS publish
RUN dotnet publish "./P2P.csproj" -c Release -o /app/publish

# Final image
FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .

# Optional: copy DB if needed
# COPY database.db ./database.db

ENTRYPOINT ["dotnet", "P2P.dll"]
