# EC2 Instance Module Outputs

output "instance_id" {
  description = "ID of the EC2 instance"
  value       = aws_instance.this.id
}

output "public_ip" {
  description = "Public IP address of the instance"
  value       = var.associate_public_ip_address ? aws_instance.this.public_ip : aws_eip.this[0].public_ip
}

output "private_ip" {
  description = "Private IP address of the instance"
  value       = aws_instance.this.private_ip
}

output "public_dns" {
  description = "Public DNS of the instance"
  value       = aws_instance.this.public_dns
}

output "instance_url" {
  description = "HTTP URL of the instance"
  value       = "http://${var.associate_public_ip_address ? aws_instance.this.public_ip : aws_eip.this[0].public_ip}"
}

output "ssh_command" {
  description = "SSH command to connect to the instance"
  value       = "ssh -i /path/to/${var.key_name}.pem ubuntu@${var.associate_public_ip_address ? aws_instance.this.public_ip : aws_eip.this[0].public_ip}"
}
