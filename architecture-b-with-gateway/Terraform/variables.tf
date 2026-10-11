# Variables for EC2 deployment

# AWS Configuration
variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "us-east-2"
}

variable "aws_profile" {
  description = "AWS credentials profile name from ~/.aws/credentials"
  type        = string
  default     = "music"
}

# Network Configuration
variable "vpc_id" {
  description = "Existing VPC ID"
  type        = string
  default     = "vpc-1d815474"
}

variable "subnet_id" {
  description = "Subnet ID for EC2 instances"
  type        = string
  default     = "subnet-9162c5f8"
}

# Shared Configuration
variable "ami_id" {
  description = "AMI ID for EC2 instances"
  type        = string
  default     = "ami-0e5497a77ef21b5ac" # Ubuntu 26.04 LTS (us-east-2)
}

variable "key_name" {
  description = "Key pair name for SSH access"
  type        = string
  default     = "soetintaung"
}

variable "allowed_ssh_cidr" {
  description = "CIDR block allowed for SSH access (0.0.0.0/0 for all, or your IP)"
  type        = string
  default     = "0.0.0.0/0"
}

# Kong API Gateway Configuration
variable "kong_instance_name" {
  description = "Name tag for Kong API Gateway EC2 instance"
  type        = string
  default     = "kong-api-gateway"
}

variable "kong_instance_type" {
  description = "EC2 instance type for Kong"
  type        = string
  default     = "t3.micro"
}

variable "kong_root_volume_size" {
  description = "Root volume size in GB for Kong"
  type        = number
  default     = 8
}

variable "kong_allowed_ports" {
  description = "List of ports to allow for Kong API Gateway"
  type        = list(number)
  default     = [22, 80, 443, 3000, 8000, 8001, 8443, 1337]
}

# Web Server Configuration
variable "web_instance_name" {
  description = "Name tag for Web Server EC2 instance"
  type        = string
  default     = "web-server"
}

variable "web_instance_type" {
  description = "EC2 instance type for Web Server"
  type        = string
  default     = "t3.micro"
}

variable "web_root_volume_size" {
  description = "Root volume size in GB for Web Server"
  type        = number
  default     = 8
}

variable "web_allowed_ports" {
  description = "List of ports to allow for Web Server"
  type        = list(number)
  default     = [22, 80, 443]
}
