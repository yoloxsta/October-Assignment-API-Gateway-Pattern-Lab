# EC2 Instance Module - Creates an EC2 instance with root volume

resource "aws_instance" "this" {
  ami                    = var.ami
  instance_type          = var.instance_type
  key_name               = var.key_name
  subnet_id              = var.subnet_id
  vpc_security_group_ids = var.vpc_security_group_ids

  associate_public_ip_address = var.associate_public_ip_address

  # Root volume configuration
  root_block_device {
    volume_size           = var.root_volume_size
    volume_type           = var.root_volume_type
    encrypted             = false
    delete_on_termination = true
  }

  # User data (optional)
  user_data = var.user_data != "" ? var.user_data : null

  tags = merge(
    {
      Name = var.name
    },
    var.tags
  )
}

# Elastic IP (optional - can be enabled by setting variable)
resource "aws_eip" "this" {
  count  = var.associate_public_ip_address ? 0 : 1
  instance = aws_instance.this.id
  domain   = "vpc"

  tags = {
    Name = "${var.name}-eip"
  }
}
